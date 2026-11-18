# Project guidelines

## Architecture

- Use Feature-Sliced Design (FSD). Keep application composition in `app`, route-level screens in `pages`, independent interface blocks in `widgets`, and reusable primitives in `shared`.
- `app` may compose pages through each page's public `index.ts` API. Pages may compose widgets through each widget's public API. Widgets may depend on `shared` and on lower FSD layers only.
- A slice may import another slice only through that slice's `index.ts`. Direct relative imports are for files inside the same slice. Do not create circular dependencies.
- Do not add empty `features` or `entities` layers. Introduce them when real domain behavior requires them.

## Code

- Keep TypeScript strict and do not use `any`. Prefer explicit, narrow types.
- Use React functional components.
- Use SCSS Modules for component styles and BEM names for CSS classes.
- Use the `@/*` alias for imports rooted in `src`. Avoid long chains of `../` across slices.
- Keep global styling in `src/app/styles`; use shared CSS custom properties for design tokens in lower layers.

## Runtime and dependencies

- Use pnpm only. Keep `packageManager` pinned in `package.json` and commit only `pnpm-lock.yaml` as the dependency lockfile.
- Target Chrome 81 (`build.target` and `build.cssTarget`). Check browser support before using JavaScript or CSS platform APIs; use documented APIs and add a polyfill only when necessary.
- Do not use undocumented APIs.
- Never store secrets or private credentials in frontend code or assets.
- Keep dependencies minimal and do not add UI frameworks without a concrete need.
