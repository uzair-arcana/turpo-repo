# @hirehub/shared

Mini shared package for DTOs, constants and other shareable code.

- Use `@hirehub/shared` locally via TypeScript path mapping or by importing from the package when you configure your monorepo.
- Build with `pnpm/npm/yarn` and run `npm run build` inside the `shared/` folder to produce `dist/`.

Example:

```ts
import { ExampleDto, createExampleDto, EXAMPLE_CONSTANT } from '@hirehub/shared';
```
