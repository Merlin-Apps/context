import { isObservable, Observable, of, throwError } from "rxjs";
import { delay, switchMap, take, takeUntil } from "rxjs/operators";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vitest,
  vi,
} from "vitest";
import { ContextFactory, createContextFactory } from "../context";

import { subscribeSpyTo } from "@hirez_io/observer-spy";

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
  afterEach(() => {
    context.destroy();
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

  it("should return one value each time the effect is call", () => {
    const effectSuccess = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(switchMap((a) => of(a + " effect")))
    );

    const effectOneSpy = subscribeSpyTo(effectSuccess("One"));
    const effectTwoSpy = subscribeSpyTo(effectSuccess("Two"));

    effectOneSpy.unsubscribe();
    effectTwoSpy.unsubscribe();

    expect(effectOneSpy.getFirstValue()).toBe("One effect");
    expect(effectTwoSpy.getFirstValue()).toBe("Two effect");
  });

  it("should the effect function be called with the correct value and only once for each effect call", () => {
    const effectToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(switchMap((a) => of(a + " effect")))
    );

    const returnFunc = vitest.fn((v) => v);
    const returnFunc2 = vitest.fn((v) => v);
    const errorFunc = vitest.fn((e) => e);

    //Fire the effect
    effectToCall("Test Success", returnFunc, errorFunc);
    effectToCall("Test Success 2", returnFunc2, errorFunc);

    expect(returnFunc).toBeCalledTimes(1);
    expect(returnFunc).toHaveReturnedWith("Test Success effect");
    expect(returnFunc2).toBeCalledTimes(1);
    expect(returnFunc2).toHaveReturnedWith("Test Success 2 effect");
    expect(errorFunc).not.toBeCalled();
  });

  it("should the effect function not fire the return function when the effect throws an error", () => {
    const errorToReturn = new Error("Error to return");
    const effectToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(switchMap(() => throwError(errorToReturn)))
    );

    const returnFunc = vitest.fn((v) => v);
    const errorFunc = vitest.fn((e) => e);

    //Fire the effect
    effectToCall("Test Error", returnFunc, errorFunc);

    expect(errorFunc).toBeCalled();
    expect(errorFunc).toHaveReturnedWith(errorToReturn);
    expect(returnFunc).not.toBeCalled();
  });

  it("should the effect on value -> error -> value dont stop the effect ", () => {
    const effectSuccess = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        switchMap((a) => {
          if (a === "Error") return throwError(new Error("Error"));
          return of(a + " effect");
        })
      )
    );

    const effectsSpyFactory = (value: string) =>
      subscribeSpyTo(effectSuccess(value), {
        expectErrors: true,
      });

    const effectOneSpy = effectsSpyFactory("One");
    const effectErrorSpy = effectsSpyFactory("Error");
    const effectTwoSpy = effectsSpyFactory("Two");

    effectOneSpy.unsubscribe();
    effectErrorSpy.unsubscribe();
    effectTwoSpy.unsubscribe();

    expect(effectOneSpy.getFirstValue()).toBe("One effect");
    expect(effectTwoSpy.getFirstValue()).toBe("Two effect");
    expect(effectErrorSpy.receivedError()).toBe(true);
    // expect(effectErrorSpy.getError()).toBe(effectError);
  });

  it("should parallel effects with different time don't override the auto loading", () => {
    vi.useFakeTimers();
    const effect1Time = 5000; //5 seconds
    const effect2Time = 2000; //2 Seconds;
    const effect1ToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        switchMap((a) => of(a + " effect 1").pipe(delay(effect1Time)))
      )
    );
    const effect2ToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        switchMap((a) => of(a + " effect 2").pipe(delay(effect2Time)))
      )
    );
    const loadingSpy = subscribeSpyTo(context.loading$);

    //After running must be initalized the loading with false
    expect(loadingSpy.getFirstValue()).toBe(false);

    //Run one effect and wait some time
    effect1ToCall("Delayed");
    vi.advanceTimersByTime(1000); //Advance less than effects times
    expect(loadingSpy.getLastValue()).toBe(true);

    //Run the second effect when the first one is running
    effect2ToCall("Delayed");
    vi.advanceTimersByTime(500); //Advance less than effects times
    expect(loadingSpy.getLastValue()).toBe(true);

    //Second effects finish but not the first one yet
    vi.advanceTimersByTime(2500); //Advance less than effect1 time and more than effect2 time
    expect(loadingSpy.getLastValue()).toBe(true);

    //Second effects finish but not the first one yet
    vi.advanceTimersByTime(5500); //Advance less than effect1 time and more than effect2 time
    expect(loadingSpy.getLastValue()).toBe(false);

    //Finish all effects
    vi.runAllTimers();
    expect(loadingSpy.getLastValue()).toBe(false);
  });

  it("should pick method get a part of the state with a callback", () => {
    const name$ = context.pick((state) => state.name);
    const age$ = context.pick((state) => state.age);

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    expect(name.getFirstValue()).toEqual("John");
    expect(age.getFirstValue()).toEqual(20);
  });

  it("should pluck method get a part of the state with a string literal", () => {
    const name$ = context.pluck("name");
    const age$ = context.pluck("age");

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    expect(name.getFirstValue()).toEqual("John");
    expect(age.getFirstValue()).toEqual(20);
  });

  it("should picker method return an object with each part of the state as selectors", () => {
    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    expect(name.getFirstValue()).toEqual("John");
    expect(age.getFirstValue()).toEqual(20);
  });

  it("should update method update the actual value of the state", () => {
    const { name$ } = context.picker;

    const name = subscribeSpyTo(name$);

    context.update((state) => ({ ...state, name: "Will" }));
    expect(name.getFirstValue()).toEqual("John");
    expect(name.getLastValue()).toEqual("Will");
  });

  it("should patch method update the actual value of the state", () => {
    const { name$ } = context.picker;

    const name = subscribeSpyTo(name$);

    context.patch({ name: "Will" });
    expect(name.getFirstValue()).toEqual("John");
    expect(name.getLastValue()).toEqual("Will");
  });

  it("should value method return the actual value of the state as a getter", () => {
    const { name, age } = context.value;

    context.patch({ name: "Will", age: 32 });

    const { name: updateName, age: updateAge } = context.value;

    expect(name).toEqual("John");
    expect(age).toEqual(20);

    expect(updateName).toEqual("Will");
    expect(updateAge).toEqual(32);
  });

  it("should have an errors$ observable that contains arrays of the different effects", () => {
    const errors$ = context.errors$;

    context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(switchMap((a) => of(a + " effect 1")))
    );
    context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(switchMap((a) => of(a + " effect 2")))
    );

    const errors = subscribeSpyTo(errors$);

    expect(errors.getFirstValue()).toStrictEqual([null, null]);
    expect(errors.getFirstValue().length).toBe(2);
  });

  it("should errors$ contains the corresponding error in the index of the array", () => {
    const errors$ = context.errors$;

    const effect1ToCall = context.effect((trigger$: Observable<void>) =>
      trigger$.pipe(
        switchMap(() => throwError(new Error("Error for effect 1")))
      )
    );

    const effect2ToCall = context.effect((trigger$: Observable<void>) =>
      trigger$.pipe(switchMap(() => of("No error effect")))
    );

    const effect3ToCall = context.effect((trigger$: Observable<void>) =>
      trigger$.pipe(
        switchMap(() => throwError(new Error("Error for effect 2")))
      )
    );

    effect3ToCall();
    effect1ToCall();
    effect2ToCall();

    const errors = subscribeSpyTo(errors$);

    const errorsResult = errors.getLastValue() ?? [];
    expect(errorsResult[0]?.message).toBe("Error for effect 1");
    expect(errorsResult[1]).toBe(null);
    expect(errorsResult[2]?.message).toBe("Error for effect 2");
  });

  it("should an effect called twice first with error and the with no error, the errors$ should contain null for that effect", () => {
    const errors$ = context.errors$;

    const effect1ToCall = context.effect((trigger$: Observable<boolean>) =>
      trigger$.pipe(
        switchMap((emitError) => {
          if (!emitError) {
            return of("Effect callled");
          } else {
            return throwError(new Error("Error for effect 1"));
          }
        })
      )
    );

    effect1ToCall(true);
    effect1ToCall(false);

    const errors = subscribeSpyTo(errors$);

    const errorsResult = errors.getLastValue() ?? [];
    expect(errorsResult[0]).toBe(null);
  });

  it("should have a method clearError that receives an index and clear set that error to null in errors$ array", () => {
    const errors$ = context.errors$;
    const clearError = context.clearError;

    const effect1ToCall = context.effect((trigger$: Observable<void>) =>
      trigger$.pipe(
        switchMap(() => throwError(new Error("Error for effect 1")))
      )
    );

    const effect2ToCall = context.effect((trigger$: Observable<void>) =>
      trigger$.pipe(
        switchMap(() => throwError(new Error("Error for effect 2")))
      )
    );

    effect1ToCall();
    effect2ToCall();
    clearError(1);

    const errors = subscribeSpyTo(errors$);
    const errorsResult = errors.getLastValue() ?? [];
    expect(errorsResult[0]?.message).toBe("Error for effect 1");
    expect(errorsResult[1]).toBe(null);
  });

  it("should have a method clearAllErrors method that set to null all the elements of errors$ array", () => {
    const errors$ = context.errors$;
    const clearErrors = context.clearAllErrors;

    const effect1ToCall = context.effect((trigger$: Observable<void>) =>
      trigger$.pipe(
        switchMap(() => throwError(new Error("Error for effect 1")))
      )
    );

    const effect2ToCall = context.effect((trigger$: Observable<void>) =>
      trigger$.pipe(
        switchMap(() => throwError(new Error("Error for effect 2")))
      )
    );

    effect1ToCall();
    effect2ToCall();
    clearErrors();

    const errors = subscribeSpyTo(errors$);
    const errorsResult = errors.getLastValue() ?? [];
    expect(errorsResult[0]).toBe(null);
    expect(errorsResult[1]).toBe(null);
  });

  it("should have a getter method errors that returns the errors array", () => {
    const effect1ToCall = context.effect((trigger$: Observable<void>) =>
      trigger$.pipe(
        switchMap(() => throwError(new Error("Error for effect 1")))
      )
    );

    const effect2ToCall = context.effect((trigger$: Observable<void>) =>
      trigger$.pipe(
        switchMap(() => throwError(new Error("Error for effect 2")))
      )
    );

    effect1ToCall();
    effect2ToCall();

    const errorsResult = context.errors;
    expect(errorsResult[0]?.message).toBe("Error for effect 1");
    expect(errorsResult[1]?.message).toBe("Error for effect 2");
  });
});
