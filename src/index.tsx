import { wireActors } from "./composition/actors";
import { wireServices } from "./composition/services";
import { launchTui } from "./tui/launch";

const services = wireServices({ home: process.env["HOME"] ?? "" });
const actors = wireActors(services);
const code = await launchTui({ services, actors });
actors.dispose();
process.exitCode = code;
