// The Prisma monorepo workaround plugin ships no type declarations.
declare module "@prisma/nextjs-monorepo-workaround-plugin" {
  export class PrismaPlugin {
    constructor(options?: unknown);
    apply(compiler: unknown): void;
  }
}
