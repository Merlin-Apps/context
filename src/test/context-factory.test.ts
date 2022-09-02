import { beforeEach, describe, expect, it } from "vitest";
import { ContextFactory, createContextFactory } from "../context";

describe("ContextFactory", () => {
  type State = {
    name: string;
    age: number;
  };
  const initialState = {
    name: "John",
    age: 20,
  };
  let context: ContextFactory<State>;

  beforeEach(() => {
    context = createContextFactory<State>(initialState);
  });

  it("should be a function", () => {
    const context = createContextFactory;

    expect(typeof context).toBe("function");
  });

  it("should create a context factory with createContextFactory method", () => {
    expect(context).toBeDefined();
    expect(context.pick).toBeDefined();
    expect(context.update).toBeDefined();
    expect(context.effect).toBeDefined();
  });

  it("should update callback return the same properties of state that is defined in State Type", () => {
    type State = {
      name: string;
      age: number;
    };

    const context = createContextFactory<State>({
      name: "John",
      age: 30,
    });
    const updateStateFn = () =>
      context.update((state) => ({
        ...state,
        name: "John",
        intruderKey: "intruder",
        anotherOne: "another",
      }));

    expect(() => updateStateFn()).toThrowError("intruderKey");
    expect(() => updateStateFn()).toThrowError("anotherOne");
  });
});
