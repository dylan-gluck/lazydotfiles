# jj for git users

A practical cheatsheet for [Jujutsu (jj)](https://github.com/martinvonz/jj) written from the perspective of a long-time git user. Focuses on the model shifts that trip people up, then the day-to-day commands.

---

## 1. The mental model

### What's the same

- Underneath, jj on a git repo writes git objects. `.jj/` is a sidecar; `.git/` is still there. You can use `git` directly when needed (e.g. `git remote -v`).
- Commits, parents, trees, blobs — all the same.

### What's different (the four big shifts)

**1. The working copy is a real commit (`@`).**
There is no "staging area" and no "dirty working tree." Every edit you make is automatically snapshotted into the commit `@`. When you want to "start a new commit," you create a new empty commit with `jj new` and `@` moves there. Unstaged/staged/committed collapses into "which commit are you editing?"

**2. Bookmarks are pointers, not branches.**
A "branch" in jj is called a **bookmark**. It's a label pinned to a specific commit. Bookmarks **do not auto-advance** when you create new commits — you must explicitly move them. This is the #1 thing that confuses git refugees.

**3. Commits have two IDs.**

- **Change ID** (e.g. `wvvxoqrt`) — stable across rewrites. Think of it as "the identity of this logical change."
- **Commit ID** (e.g. `c22a223a`) — the git SHA. Changes when the commit is rewritten.

When you amend, rebase, or squash, the change ID stays; the commit ID changes. Most jj commands accept either.

**4. History is freely rewritable, with an undo log.**
jj records every operation (`jj op log`). Anything destructive can be undone with `jj op restore <op-id>`. This makes amending, rebasing, splitting, and reordering low-risk — even after they've been pushed to your own branches.

---

## 2. Setup

```bash
# One-time global config
jj config set --user user.name  "Your Name"
jj config set --user user.email "you@example.com"

# In an existing git repo: colocate jj alongside git
jj git init --colocate

# Clone a git repo as jj
jj git clone git@github.com:org/repo.git

# Add a remote to an existing jj repo
jj git remote add origin git@github.com:org/repo.git
```

Colocated repos let you keep using `git` tools (gh CLI, IDE integrations, lazygit) while doing day-to-day work in jj.

---

## 3. The status/log/diff trio

```bash
jj status              # like `git status` — shows @ and its parent
jj log                 # like `git log --graph --all` by default
jj log -r 'main..@'    # commits on current branch not in main
jj log -r 'all()'      # full history (linear ancestor graph)
jj diff                # diff of @ vs its parent (your "uncommitted" changes)
jj diff -r <rev>       # diff of any commit
jj show <rev>          # commit message + diff
```

Note: `jj log` uses a **revset** language — see §10. `main..@` means "ancestors of `@` that are not ancestors of `main`."

---

## 4. The git → jj command Rosetta

| git                           | jj                                                   | notes                                                         |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `git status`                  | `jj status`                                          |                                                               |
| `git log`                     | `jj log`                                             | jj defaults to a graph view                                   |
| `git diff`                    | `jj diff`                                            | shows `@` vs parent                                           |
| `git diff --staged`           | —                                                    | no staging area                                               |
| `git add <file>`              | —                                                    | edits to `@` are auto-tracked                                 |
| `git commit -m "..."`         | `jj commit -m "..."`                                 | describes `@` and starts a new empty `@`                      |
| `git commit --amend`          | `jj squash`                                          | squash `@` into `@-`                                          |
| `git commit --amend -m "..."` | `jj describe -m "..."`                               | rewords `@`                                                   |
| `git checkout <branch>`       | `jj new <bookmark>`                                  | starts a new commit on top of it                              |
| `git checkout -b feat`        | `jj new main` then `jj bookmark create feat -r @`    |                                                               |
| `git switch <branch>`         | `jj edit <rev>`                                      | rarely what you want — see §6                                 |
| `git branch feat`             | `jj bookmark create feat -r <rev>`                   |                                                               |
| `git branch -m old new`       | `jj bookmark rename old new`                         |                                                               |
| `git branch -d feat`          | `jj bookmark delete feat`                            |                                                               |
| `git reset HEAD~`             | `jj abandon` (drop @) or `jj edit @-`                |                                                               |
| `git reset --hard <rev>`      | `jj edit <rev>` + `jj abandon` orphans               |                                                               |
| `git rebase main`             | `jj rebase -d main`                                  | rebases `@`'s branch onto main                                |
| `git rebase -i`               | `jj split` / `jj squash` / `jj rebase`               | no interactive mode needed                                    |
| `git cherry-pick <rev>`       | `jj duplicate <rev>` then `jj rebase`                |                                                               |
| `git stash`                   | —                                                    | just `jj new` — your work stays in its own commit             |
| `git pull`                    | `jj git fetch` then `jj rebase -d <bookmark>@origin` |                                                               |
| `git push`                    | `jj git push`                                        | pushes tracked bookmarks                                      |
| `git push -f`                 | `jj git push`                                        | jj rewrites are non-fast-forward by default; warns but allows |
| `git reflog`                  | `jj op log`                                          | every operation is recorded                                   |
| `git reset --hard HEAD@{1}`   | `jj op restore <op-id>`                              | undo any operation                                            |
| `git blame`                   | `jj file annotate <path>`                            |                                                               |

---

## 5. The working copy and "amending"

There is no `git add`. Every change you make in your editor is **automatically** part of the working-copy commit `@`. To "commit," you describe `@` and create a fresh empty `@`:

```bash
# Edit some files...
jj describe -m "Add login flow"   # gives @ a message
jj new                            # creates a fresh empty @ on top
# ...or in one step:
jj commit -m "Add login flow"     # describe + new
```

**Amending the previous commit** (the most common operation):

```bash
# Edit files in working copy, then:
jj squash                         # moves @'s changes into @- (the previous commit)
# or with a new message:
jj squash -m "Updated message"
```

`jj squash` works between any two commits, not just `@` and `@-`:

```bash
jj squash --into <rev>            # squash @'s changes into a specific commit
jj squash -i                      # interactive: pick which hunks to move
jj squash --from <rev> --into <rev>  # move changes between two existing commits
```

**Splitting a commit:**

```bash
jj split           # interactive: choose which changes go in first new commit
jj split -r <rev>  # split a non-@ commit
```

**Rewording without changing content:**

```bash
jj describe -m "new message"          # rewords @
jj describe <rev> -m "new message"    # rewords any commit
```

---

## 6. `jj new` vs `jj edit` (important)

These look similar but behave very differently:

- **`jj new <rev>`** — creates a _new empty commit_ on top of `<rev>` and moves `@` there. This is what you want 95% of the time. It's the equivalent of "checkout this branch and start working."
- **`jj edit <rev>`** — moves `@` _to be_ `<rev>`. You are now editing that existing commit in place; any working-copy edits modify it. Use only when you deliberately want to amend a commit other than the tip.

**Rule of thumb:** always `jj new`, never `jj edit`, unless you specifically want to mutate an existing commit's contents.

---

## 7. Bookmarks (branches)

```bash
jj bookmark list                       # local bookmarks
jj bookmark list --all-remotes         # include @origin tracking info
jj bookmark create feat -r @           # create at current commit
jj bookmark set feat -r @              # move existing bookmark (forward only by default)
jj bookmark set feat -r @ --allow-backwards   # required to move backwards
jj bookmark move feat --to @           # alias for `set`
jj bookmark rename old new
jj bookmark delete feat                # local delete
jj bookmark forget feat                # delete locally + on remote on next push
jj bookmark track feat@origin          # start tracking a remote bookmark
```

**The auto-advance gotcha.** After `jj commit` or `jj new`, your bookmark still points at the _old_ tip:

```bash
$ jj log
@  (new commit)
○  feat | latest work     ← bookmark stuck here, even though @ has moved past
```

Fix it:

```bash
jj bookmark set feat -r @-     # move feat to @'s parent (the just-finished commit)
```

You can configure auto-advance globally in `~/.config/jj/config.toml`:

```toml
[experimental-advance-branches]
enabled-branches = ["glob:*"]
```

---

## 8. Rebasing and merging

jj makes rebasing routine, not scary.

```bash
# Rebase the whole branch leading to @ onto main
jj rebase -d main

# Rebase just one commit (and descendants) onto a new parent
jj rebase -s <rev> -d <new-parent>

# Rebase a specific commit (without descendants)
jj rebase -r <rev> -d <new-parent>

# Rebase a whole bookmark
jj rebase -b feat -d main
```

**Conflicts** in jj are first-class: a commit can be in a "conflicted" state and you can keep working. Resolve with `jj resolve` (opens your merge tool) or by editing the conflict markers in the working copy and then `jj squash`-ing the resolution. Conflicted commits show as `××` in `jj log`.

**Merging** (creating a merge commit):

```bash
jj new main feat -m "Merge feat into main"
jj bookmark set main -r @-
```

But for most "merge a PR" scenarios, you just fast-forward the bookmark:

```bash
jj bookmark set main -r feat
jj git push --bookmark main
```

---

## 9. Remotes: fetch, push, pull

```bash
jj git remote add origin <url>
jj git remote list

jj git fetch                     # fetch all remotes
jj git fetch --remote origin

# Push specific bookmarks
jj git push --bookmark feat
jj git push --bookmark main --bookmark feat

# Push all tracked bookmarks
jj git push

# First-time push of a new bookmark
jj git push --bookmark new-feat --allow-new
```

**No `jj pull`.** Use `jj git fetch` then `jj rebase -d main@origin` (or whichever bookmark).

**Force-push equivalent.** jj does not have a separate `--force`. When you rewrite a commit that has already been pushed, `jj git push` reports it as `Move sideways bookmark X` and pushes it (non-fast-forward). This is normal — jj treats your own bookmarks as freely rewritable. To prevent accidents on shared bookmarks, configure them as immutable in jj config.

**Pruning.** Bookmarks deleted on the remote are reflected after `jj git fetch`; locally deleted bookmarks are removed from the remote on next `jj git push` if they were tracking.

---

## 10. Revsets: jj's query language

Most commands take `-r <revset>`. The full reference is `jj help revsets`. Most-used:

| Revset                         | Meaning                                           |
| ------------------------------ | ------------------------------------------------- |
| `@`                            | working copy                                      |
| `@-`                           | parent of working copy                            |
| `<change-id>` or `<commit-id>` | a specific revision                               |
| `<bookmark>`                   | the commit a bookmark points to                   |
| `<bookmark>@origin`            | remote-tracked bookmark                           |
| `main..@`                      | commits in `@`'s ancestry not in `main`           |
| `main..feat`                   | commits on `feat` not yet in `main` (PR contents) |
| `::main`                       | all ancestors of `main` (inclusive)               |
| `main::`                       | all descendants of `main` (inclusive)             |
| `heads(all())`                 | tips of all branches                              |
| `mine()`                       | commits authored by you                           |
| `empty()`                      | empty commits                                     |
| `description(regex)`           | commits whose message matches                     |
| `author(regex)`                | commits by matching author                        |
| `trunk()`                      | the configured trunk bookmark (usually `main`)    |

Combine with `&` (and), `|` (or), `~` (not):

```bash
jj log -r 'mine() & main..@'
jj log -r '::feat ~ ::main'      # same as main..feat
```

---

## 11. The operation log (your safety net)

```bash
jj op log                  # every op you've performed
jj op show <op-id>         # what changed in that op
jj op restore <op-id>      # roll the entire repo back to that op
jj op undo                 # undo the most recent op
```

This is `git reflog` on steroids: it covers commits, rebases, bookmark moves, fetches — everything. If you screw up a rebase, `jj op undo` puts you exactly where you were.

---

## 12. Common workflows

### Start a feature

```bash
jj git fetch
jj new main@origin                            # new commit on latest main
jj bookmark create feat-login -r @            # name it
# ...edit...
jj describe -m "Login: add OAuth provider"
jj new                                        # next commit
# ...edit...
jj commit -m "Login: wire callback handler"
jj bookmark set feat-login -r @-              # advance bookmark to latest finished commit
jj git push --bookmark feat-login --allow-new
gh pr create --base main --head feat-login
```

### Update a feature branch with latest main

```bash
jj git fetch
jj rebase -b feat-login -d main@origin
jj git push --bookmark feat-login             # non-fast-forward; jj handles it
```

### Amend a PR after review feedback

```bash
# ...edit files in working copy on top of feat-login...
jj squash                                     # fold edits into feat-login's tip
jj git push --bookmark feat-login
```

### Split a too-large commit

```bash
jj split -r <rev>                             # interactive splitter
```

### Reorder commits

```bash
jj rebase -r <rev> -d <new-parent>            # move a single commit
```

### Drop a commit

```bash
jj abandon <rev>                              # descendants are auto-rebased
```

### "I don't know what I did, undo it"

```bash
jj op log
jj op undo                                    # or `jj op restore <op-id>`
```

---

## 13. Tips and pitfalls

- **Don't run `jj edit` on a pushed commit** unless you mean to rewrite + force-push it. Use `jj new` to start fresh work.
- **Bookmarks don't move automatically.** After `jj commit`, run `jj bookmark set <name> -r @-` (or enable auto-advance in config).
- **Empty `@` is normal.** After `jj commit` or `jj squash`, you'll see `(empty) (no description set)` as `@`. That's the next workspace, ready for edits.
- **`jj describe` with `--reset-author` is deprecated**; use `jj metaedit --update-author` to fix author/committer on existing commits.
- **Conflicts don't block you.** A conflicted commit still exists; you can work elsewhere and resolve it later.
- **Push rewrites are not the apocalypse.** Your own feature bookmarks are fine to rewrite. Configure shared bookmarks (`main`, release branches) as immutable to protect them.
- **Use change IDs, not commit IDs**, when referring to commits across rewrites — they're stable.
- **Colocated repos** (`jj git init --colocate`) let `git` and `jj` coexist; useful while learning, and for tooling that only speaks git.

---

## 14. Further reading

- Official tutorial: <https://martinvonz.github.io/jj/latest/tutorial/>
- Revset reference: `jj help revsets`
- Config reference: `jj help config`
- Built-in help: every command has `--help`
