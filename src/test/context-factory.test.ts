import { Observable, of, throwError, timer } from "rxjs";
import {
  concatMap,
  delay,
  delayWhen,
  exhaustMap,
  mergeMap,
  switchMap,
  tap,
} from "rxjs/operators";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
  vitest,
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

  it("should the update method throw an Error when a new key is added that don't belongs to original state", () => {
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

  test("should the effect on value -> error -> value dont break/stop/shutdown the effect", () => {
    const effectSuccess = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        switchMap((a) => {
          if (a === "Error") return throwError(new Error("Error"));
          return of(a + " effect");
        })
      )
    );

    const results$ = effectSuccess("One");
    const effectOneSpy = subscribeSpyTo(results$, { expectErrors: true });
    effectSuccess("Error");
    const effectTwoSpy = subscribeSpyTo(effectSuccess("Two"), {
      expectErrors: true,
    });

    expect(effectOneSpy.getFirstValue()).toBe("One effect");
    expect(effectOneSpy.receivedError()).toBe(true);
    expect(effectTwoSpy.getLastValue()).toBe("Two effect");

    effectOneSpy.unsubscribe();
    // expect(effectErrorSpy.getError()).toBe(effectError);
  });

  test("should the effect on error -> error -> value run the effect one ", () => {
    const effectSuccess = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        switchMap((a) => {
          if (a === "Error") return throwError(new Error("Error"));
          return of(a + " effect");
        })
      )
    );

    const returnSpyFn = vitest.fn((v) => v);

    effectSuccess("Error", returnSpyFn);
    effectSuccess("Error", returnSpyFn);
    effectSuccess("One", returnSpyFn);

    expect(returnSpyFn).toBeCalledTimes(1);
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

  test("should have a method clearError that receives an index and clear set that error to null in errors$ array", () => {
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

  test("should have a method clearAllErrors method that set to null all the elements of errors$ array", () => {
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

  test("should have a getter method errors that returns the errors array", () => {
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

  test("should run the effect correclty", () => {
    const simulateApiCall = (param1: string) => of({ name: param1, age: 22 });

    const effectToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        switchMap((param) =>
          simulateApiCall(param).pipe(
            tap((data) => context.patch({ name: data.name, age: data.age }))
          )
        )
      )
    );
    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    effectToCall("Test Name 1");

    expect(name.getFirstValue()).toEqual("John");
    expect(age.getFirstValue()).toEqual(20);
    expect(name.getLastValue()).toEqual("Test Name 1");
    expect(age.getLastValue()).toEqual(22);
  });

  test("should run the effect correclty and run the succes function on success", () => {
    const simulateApiCall = (param1: string) => of({ name: param1, age: 22 });

    const effectToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        switchMap((param) =>
          simulateApiCall(param).pipe(
            tap((data) => context.patch({ name: data.name, age: data.age }))
          )
        )
      )
    );
    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    const returnFunc = vitest.fn((v) => v);

    effectToCall("Test Name 1", returnFunc);

    expect(name.getFirstValue()).toEqual("John");
    expect(age.getFirstValue()).toEqual(20);
    expect(returnFunc).toBeCalledTimes(1);
    expect(returnFunc).toHaveBeenCalledWith({ name: "Test Name 1", age: 22 });
    expect(name.getLastValue()).toEqual("Test Name 1");
    expect(age.getLastValue()).toEqual(22);
  });

  test("should run the effect and catch the error", () => {
    const e = new Error("Error on effect");
    const simulateApiCall = (param1: string) => throwError(e);

    const effectToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(switchMap((param) => simulateApiCall(param)))
    );
    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);
    const errors = subscribeSpyTo(context.errors$);

    effectToCall("Test Name 1");

    expect(context.errors.length).toBe(1);
    expect(context.errors[0]?.message).toBe("Error on effect");
    expect(errors.getFirstValue()).toEqual([null]);
    expect(errors.getLastValue()).toEqual([e]);
    expect(name.getFirstValue()).toEqual("John");
    expect(age.getFirstValue()).toEqual(20);
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);
  });

  test("should run the effect and catch the error and run the error function", () => {
    const e = new Error("Error on effect");
    const simulateApiCall = (param1: string) => throwError(e);

    const effectToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(switchMap((param) => simulateApiCall(param)))
    );
    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    const returnFunc = vitest.fn((v) => v);
    const returnErrFunc = vitest.fn((v) => v);

    effectToCall("Test Name 1", returnFunc, returnErrFunc);

    expect(context.errors.length).toBe(1);
    expect(context.errors[0]?.message).toBe("Error on effect");
    expect(returnErrFunc).toHaveBeenCalledOnce();
    expect(returnErrFunc).toBeCalledWith(e);

    expect(name.getFirstValue()).toEqual("John");
    expect(age.getFirstValue()).toEqual(20);
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);
  });

  test("should the effect map switch two consecutives calls on the same effect with switchMap", () => {
    vi.useFakeTimers();
    const simulateApiCall = (param1: string) =>
      of({ name: param1, age: 22 }).pipe(
        delayWhen((value) => {
          if (value.name === "Test Name 1") {
            return timer(300);
          } else {
            return timer(150);
          }
        })
      );

    const effectToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        switchMap((param) =>
          simulateApiCall(param).pipe(
            tap((data) => context.patch({ name: data.name, age: data.age }))
          )
        )
      )
    );

    //Call 300 effect -> Effect running -> Call 150 effect
    // -> Cancel 300 effect -> Finish 100 efect
    effectToCall("Test Name 1");
    vi.advanceTimersByTime(50);
    effectToCall("Test Name 2");

    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    vi.advanceTimersByTime(50); //100 Total
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(150); //250 Total - Finished effect Test Name 2
    expect(name.getLastValue()).toEqual("Test Name 2");
    expect(age.getLastValue()).toEqual(22);

    vi.advanceTimersByTime(300); //550 Total - All finished effect Test Name 1 should been cancel
    expect(name.getLastValue()).toEqual("Test Name 2");
    expect(age.getLastValue()).toEqual(22);

    vi.runAllTimers();
  });

  test("should the effect reject two consecutives calls on the same effect with exhaustMap", () => {
    vi.useFakeTimers();
    const simulateApiCall = (param1: string) =>
      of({ name: param1, age: 22 }).pipe(
        delayWhen((value) => {
          if (value.name === "Test Name 1") {
            return timer(300);
          } else {
            return timer(150);
          }
        })
      );

    const effectToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        exhaustMap((param) =>
          simulateApiCall(param).pipe(
            tap((data) => context.patch({ name: data.name, age: data.age }))
          )
        )
      )
    );

    //Call 300 effect -> Effect running -> Call 150 effect
    // -> Cancel 150 effect -> Finish 300 effect
    effectToCall("Test Name 1");
    vi.advanceTimersByTime(50);
    effectToCall("Test Name 2");

    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    vi.advanceTimersByTime(50); //100 Total
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(150); //250 Total - Same a initial state because should be canceled the Test Name 2 effect
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(300); //550 Total - All finished effect Test Name 1 should been cancel
    expect(name.getLastValue()).toEqual("Test Name 1");
    expect(age.getLastValue()).toEqual(22);

    vi.runAllTimers();
  });

  test("should effect with two consecutives calls be called one and then the other using concatMap", () => {
    vi.useFakeTimers();
    const simulateApiCall = (param1: string) =>
      of({ name: param1, age: 22 }).pipe(
        delayWhen((value) => {
          if (value.name === "Test Name 1") {
            return timer(300);
          } else {
            return timer(150);
          }
        })
      );

    const effectToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        concatMap((param) =>
          simulateApiCall(param).pipe(
            tap((data) => context.patch({ name: data.name, age: data.age }))
          )
        )
      )
    );

    //Call 300 effect -> Effect running -> Call 150 effect
    // -> Finish 300 effect/Start effect 150 -> Finish 150 effect
    effectToCall("Test Name 1");
    vi.advanceTimersByTime(50); //50 Total
    effectToCall("Test Name 2");

    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    vi.advanceTimersByTime(50); //100 Total
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(150); //250 Total - Same a initial state because Test Name 1 effect is running
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(50); //300 Total - All finished effect Test Name 1 should been cancel
    expect(name.getLastValue()).toEqual("Test Name 1");
    expect(age.getLastValue()).toEqual(22);

    vi.advanceTimersByTime(150); //450 Total - All finished effect Test Name 1 should been cancel
    expect(name.getLastValue()).toEqual("Test Name 2");
    expect(age.getLastValue()).toEqual(22);

    vi.runAllTimers();
  });

  test("should effect with two consecutives calls be called in parallel other using mergeMap", () => {
    vi.useFakeTimers();
    const simulateApiCall = (param1: string) =>
      of({ name: param1, age: 22 }).pipe(
        delayWhen((value) => {
          if (value.name === "Test Name 1") {
            return timer(300);
          } else {
            return timer(150);
          }
        })
      );

    const effectToCall = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        mergeMap((param) =>
          simulateApiCall(param).pipe(
            tap((data) => context.patch({ name: data.name, age: data.age }))
          )
        )
      )
    );

    //Call 300 effect -> Effect running -> Call 150 effect
    // -> Finish 300 effect/Start effect 150 -> Finish 150 effect
    effectToCall("Test Name 1");
    vi.advanceTimersByTime(50); //50 Total
    effectToCall("Test Name 2");

    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    vi.advanceTimersByTime(50); //100 Total
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(100); //200 Total - Same a initial state because Test Name 1 effect is running
    expect(name.getLastValue()).toEqual("Test Name 2");
    expect(age.getLastValue()).toEqual(22);

    vi.advanceTimersByTime(100); //300 Total - All finished effect Test Name 1 should been cancel
    expect(name.getLastValue()).toEqual("Test Name 1");
    expect(age.getLastValue()).toEqual(22);

    vi.runAllTimers();
  });

  it("should have a asyncEffect method that receives trigger method", () => {
    vi.useFakeTimers();
    const simulateApiCall: (
      p: string
    ) => Observable<{ name: string; age: number }> = (param1: string) =>
      of({ name: param1, age: 47 }).pipe(delay(100));

    const effectToCall = context.asyncEffect({
      trigger: simulateApiCall,
      success: ({ data }) => context.patch({ name: data.name, age: data.age }),
    });

    effectToCall.run("Test Name");

    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    expect(name.getFirstValue()).toEqual("John");
    expect(age.getFirstValue()).toEqual(20);

    vi.runAllTimers();
    expect(name.getLastValue()).toEqual("Test Name");
    expect(age.getLastValue()).toEqual(47);
  });

  test("should the asyncEffect map switch two consecutives calls on the same effect", () => {
    vi.useFakeTimers();
    const simulateApiCall = (param1: string) =>
      of({ name: param1, age: 22 }).pipe(
        delayWhen((value) => {
          if (value.name === "Test Name 1") {
            return timer(300);
          } else {
            return timer(150);
          }
        })
      );

    const effectToCall = context.asyncEffect({
      trigger: simulateApiCall,
      success: ({ data }) => context.patch({ name: data.name, age: data.age }),
      operation: "switch",
    });

    //Call 300 effect -> Effect running -> Call 150 effect
    // -> Cancel 300 effect -> Finish 100 efect
    effectToCall.run("Test Name 1");
    vi.advanceTimersByTime(50);
    effectToCall.run("Test Name 2");

    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    vi.advanceTimersByTime(50); //100 Total
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(150); //250 Total - Finished effect Test Name 2
    expect(name.getLastValue()).toEqual("Test Name 2");
    expect(age.getLastValue()).toEqual(22);

    vi.advanceTimersByTime(300); //550 Total - All finished effect Test Name 1 should been cancel
    expect(name.getLastValue()).toEqual("Test Name 2");
    expect(age.getLastValue()).toEqual(22);

    vi.runAllTimers();
  });

  test("should the asyncEffect map switch two consecutives calls on the same effect", () => {
    vi.useFakeTimers();
    const simulateApiCall = (param1: string) =>
      of({ name: param1, age: 22 }).pipe(
        delayWhen((value) => {
          if (value.name === "Test Name 1") {
            return timer(300);
          } else {
            return timer(150);
          }
        })
      );

    const effectToCall = context.asyncEffect({
      trigger: simulateApiCall,
      success: ({ data }) => context.patch({ name: data.name, age: data.age }),
      operation: "reject",
    });

    //Call 300 effect -> Effect running -> Call 150 effect
    // -> Cancel 150 effect -> Finish 300 effect
    effectToCall.run("Test Name 1");
    vi.advanceTimersByTime(50);
    effectToCall.run("Test Name 2");

    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    vi.advanceTimersByTime(50); //100 Total
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(150); //250 Total - Same a initial state because should be canceled the Test Name 2 effect
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(300); //550 Total - All finished effect Test Name 1 should been cancel
    expect(name.getLastValue()).toEqual("Test Name 1");
    expect(age.getLastValue()).toEqual(22);

    vi.runAllTimers();
  });

  test("should the asyncEffect map switch two consecutives calls on the same effect", () => {
    vi.useFakeTimers();
    const simulateApiCall = (param1: string) =>
      of({ name: param1, age: 22 }).pipe(
        delayWhen((value) => {
          if (value.name === "Test Name 1") {
            return timer(300);
          } else {
            return timer(150);
          }
        })
      );

    const effectToCall = context.asyncEffect({
      trigger: simulateApiCall,
      success: ({ data }) => context.patch({ name: data.name, age: data.age }),
      operation: "concat",
    });

    //Call 300 effect -> Effect running -> Call 150 effect
    // -> Finish 300 effect/Start effect 150 -> Finish 150 effect
    effectToCall.run("Test Name 1");
    vi.advanceTimersByTime(50); //50 Total
    effectToCall.run("Test Name 2");

    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    vi.advanceTimersByTime(50); //100 Total
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(150); //250 Total - Same a initial state because Test Name 1 effect is running
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(50); //300 Total - All finished effect Test Name 1 should been cancel
    expect(name.getLastValue()).toEqual("Test Name 1");
    expect(age.getLastValue()).toEqual(22);

    vi.advanceTimersByTime(150); //450 Total - All finished effect Test Name 1 should been cancel
    expect(name.getLastValue()).toEqual("Test Name 2");
    expect(age.getLastValue()).toEqual(22);

    vi.runAllTimers();
  });

  test("should the asyncEffect map switch two consecutives calls on the same effect", () => {
    vi.useFakeTimers();
    const simulateApiCall = (param1: string) =>
      of({ name: param1, age: 22 }).pipe(
        delayWhen((value) => {
          if (value.name === "Test Name 1") {
            return timer(300);
          } else {
            return timer(150);
          }
        })
      );

    const effectToCall = context.asyncEffect({
      trigger: simulateApiCall,
      success: ({ data }) => context.patch({ name: data.name, age: data.age }),
      operation: "merge",
    });

    //Call 300 effect -> Effect running -> Call 150 effect
    // -> Finish 300 effect/Start effect 150 -> Finish 150 effect
    effectToCall.run("Test Name 1");
    vi.advanceTimersByTime(50); //50 Total
    effectToCall.run("Test Name 2");

    const { name$, age$ } = context.picker;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    vi.advanceTimersByTime(50); //100 Total
    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);

    vi.advanceTimersByTime(100); //200 Total - Same a initial state because Test Name 1 effect is running
    expect(name.getLastValue()).toEqual("Test Name 2");
    expect(age.getLastValue()).toEqual(22);

    vi.advanceTimersByTime(100); //300 Total - All finished effect Test Name 1 should been cancel
    expect(name.getLastValue()).toEqual("Test Name 1");
    expect(age.getLastValue()).toEqual(22);

    vi.runAllTimers();
  });

  test("should the asyncEffect on error call should call error fn and get an error in errors picker", () => {
    const error = new Error("Error on api");

    const simulateApiCall = (param1: string) => throwError(error);

    const spyOnErrorFn = vitest.fn(({ e: Error, params: string }) => {});

    const effectToCall = context.asyncEffect({
      trigger: simulateApiCall,
      error: spyOnErrorFn,
    });

    effectToCall.run("Test Name 1");

    const { name$, age$ } = context.picker;
    const errors = context.errors;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);
    expect(errors.at(0)?.message).toBe("Error on api");
    expect(spyOnErrorFn).toBeCalledTimes(1);
    expect(spyOnErrorFn).toBeCalledWith({ e: error, params: "Test Name 1" });
  });

  //TODO: Test case when using mergeMap the errors array creates [null, Error]

  test("should have a destroy method that cleans the subscriptions used", () => {
    const simulateApiCall = (param1: string) => of({ name: param1, age: 22 });
    //ASYNC EFFECT -> created with asyncEffect
    const effectToCall = context.asyncEffect({
      trigger: simulateApiCall,
      success: ({ data }) => context.patch({ name: data.name, age: data.age }),
    });

    const spyEffect = subscribeSpyTo(effectToCall.run("Test Name 1"));

    //EFFECT WITH ERROR - Effect that runs onces -> errors -> runs twice
    const effectWithError = context.effect((trigger$: Observable<string>) =>
      trigger$.pipe(
        switchMap((a) => {
          if (a === "Error") return throwError(new Error("Error"));
          return of(a + " effect");
        })
      )
    );
    const results$ = effectWithError("One");
    const effectOneSpy = subscribeSpyTo(results$, { expectErrors: true });
    effectWithError("Error");
    const effectTwoSpy = subscribeSpyTo(effectWithError("Two"), {
      expectErrors: true,
    });

    //STATE
    const stateSpy = subscribeSpyTo(context.state$);
    //PICK
    const name$ = subscribeSpyTo(context.pick((state) => state.name));
    //PICKER
    const spyName = subscribeSpyTo(context.picker.name$);
    //PLUCK
    const spyNamePluck = subscribeSpyTo(context.pluck("name"));
    //LOADING
    const spyLoading = subscribeSpyTo(context.loading$);
    //ERRORS
    const spyErrors = subscribeSpyTo(context.errors$);

    context.destroy();

    expect(spyName.subscription.closed).toBe(true);
    expect(spyEffect.subscription.closed).toBe(true);
    expect(effectOneSpy.subscription.closed).toBe(true);
    expect(effectTwoSpy.subscription.closed).toBe(true);
    expect(stateSpy.subscription.closed).toBe(true);
    expect(spyNamePluck.subscription.closed).toBe(true);
    expect(spyLoading.subscription.closed).toBe(true);
    expect(spyErrors.subscription.closed).toBe(true);
  });

  test("should the asyncEffect on error call the onSucess option function when firing the effect", () => {
    const data = { name: "Name", age: 96 };
    const simulateApiCall = (param1: string) => of(data);

    const spyOnSuccessFn = vitest.fn(
      (data: { name: string; age: number }) => {}
    );

    const effectToCall = context.asyncEffect({
      trigger: simulateApiCall,
    });

    effectToCall.run("Test Name 1", { onSuccess: spyOnSuccessFn });

    expect(spyOnSuccessFn).toBeCalledTimes(1);
    expect(spyOnSuccessFn).toBeCalledWith(data);
  });

  test("should the asyncEffect on error call the onError option function when firing the effect", () => {
    const error = new Error("Error on api");

    const simulateApiCall = (param1: string) => throwError(error);

    const spyOnErrorFn = vitest.fn((e: Error) => {});

    const effectToCall = context.asyncEffect({
      trigger: simulateApiCall,
    });

    effectToCall.run("Test Name 1", { onError: spyOnErrorFn });

    const { name$, age$ } = context.picker;
    const errors = context.errors;

    const name = subscribeSpyTo(name$);
    const age = subscribeSpyTo(age$);

    expect(name.getLastValue()).toEqual("John");
    expect(age.getLastValue()).toEqual(20);
    expect(errors.at(0)?.message).toBe("Error on api");
    expect(spyOnErrorFn).toBeCalledTimes(1);
    expect(spyOnErrorFn).toBeCalledWith(error);
  });
});
