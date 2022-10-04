import { createContextFactory } from "./context";

const context = createContextFactory<{ a: string; b: number }>(
  {
    a: "prueba",
    b: 229,
  },
  { autoLoading: true, log: true }
);
const update = () => {
  context.update((state) => ({ ...state, a: "prueba2" }));
};

const main = () => {
  update();
};

main();
