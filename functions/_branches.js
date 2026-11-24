// Branch configuration (names, approximate location, region). Edit functions/_branches.json, nothing else.
import cfg from './_branches.json';
export const regions = cfg.regions;
export const branches = cfg.branches;
export const names = Object.fromEntries(Object.entries(cfg.branches).map(([c, b]) => [c, b.name]));
