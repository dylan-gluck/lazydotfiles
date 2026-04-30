# lazydotfiles

A tui to discover and track all your dotfiles, without having to think about it.

## Usage

```bash
ldf                     # Launch tui

ldf status              # Actively managed, discover queue
ldf log                 # Tracked changes
ldf add [path]          # Track config file or dir
ldf rm [path]           # Untrack, move back to original location

ldf config [option]     # Manage config options
ldf sync                # Sync with remote
```

## How it works

- Initializes a `jj` vcs repo in `$HOME/dotfiles`
- Tracked files are moved to dotfiles repo, symlinked back
- All changes are tracked by jj, full operation log
- Optionally auto-commit and auto-sync with remote on a schedule
- Discover new dotfiles, auto-track or queue for approval
- Removing a tracked file puts it back where it came from without losing changes

### Experimental Features

**Detect API Keys**

- Regex match for API keys in env and config files
- Sanitize by removing the value
- `OPENAI_API_KEY=sk123...` -> `OPENAI_API_KEY=`

## Configuration

Default location: `$HOME/.config/lazydotfiles/config.toml`

### Options

```toml
[path]
home = "$HOME"
dotfiles = "$HOME/dotfiles"
backup = "$HOME/.dotfiles.bak"

[discovery]
auto_track = true
include = [".config/**/*", ".claude/**/*", ".zshrc"]
exclude = [".env*", "!.env.example"]

[options]
vcs = "jj"
auto_commit = true
auto_sync = true
auto_sync_interval = "daily"

[experimental]
detect_api_keys = true
```

## Local Development

Always use the `bun` runtime:

```bash
bun install
bun dev
bun check
```

### Stack

- `bun` - Runtime and package manager
- `opentui` - Tui primitives and react bindings
- `react` - UI components, state
- `tanstack` - Router

### Route Generation

Routes are auto-generated from the `src/routes/` directory. To manually regenerate:

```bash
bun run generate-routes
```
