#!/usr/bin/env bun
import { wireServices } from "../src/composition/services";

const home = process.env["LDF_TEST_HOME"];
const target = process.env["LDF_TEST_TARGET"];
if (home === undefined || target === undefined) {
  process.stderr.write("LDF_TEST_HOME and LDF_TEST_TARGET required\n");
  process.exitCode = 2;
} else {
  const services = wireServices({ home });
  const r = await services.track.add(target);
  if (r.ok) {
    process.stdout.write(`${JSON.stringify({ ok: true, file: r.value })}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({ ok: false, error: r.error })}\n`);
    process.exitCode = 1;
  }
}
