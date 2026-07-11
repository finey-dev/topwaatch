import { publicProcedure, router } from "../index";

export const metaRouter = router({
  get: publicProcedure.query(() => ({
    name: "TopWaatch",
    description: "TopWaatch streaming backend",
    version: "0.1.0",
    hasCaptcha: false,
  })),
});
