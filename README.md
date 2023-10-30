# Merlin's Apps Context Manager

Merlin's Apps Context Manager is a powerful state management library for TypeScript. It allows you to manage and control the state of your application with ease, providing a set of convenient features and functions.
Used in conjunction with dependency injection, it can enhance application-level state management, both for large and small parts/components that need to share information in an isolated manner, or even a component's state. This ensures consistent data and information management across the entire application.
Built based on the 'Service with a Subject' pattern using RxJs.

## Features

- **Observable State**: Easily manage and observe the state of your application using RxJS observables.
- **Auto-Loading**: Enable auto-loading for effects to simplify asynchronous operations.
- **Logging**: Enable logging for development mode to help with debugging.
- **Error Handling**: Automatically catch and manage errors for your effects.
- **Flexible Pickers**: Pick and observe specific parts of your state using pickers.
- **Update and Patch**: Modify your state with update and patch functions.
- **Clean and Destroy**: Properly clean up and destroy your context when it's no longer needed.
- **Async Effects**: Create and run asynchronous effects with success and error handling.
- **Multiple Operation Modes**: Choose from "switch," "reject," "concat," or "merge" for effect operations.

## Installation

To get started with Merlin's Apps Context Manager, you can install it via npm or yarn.

```bash
npm install @merlinshut/context
# or
yarn add @merlinshut/context
```

## Usage

### Creation

```typescript
import { createContextFactory } from "@merlinshut/context";

// Define your initial state
const initialState = { count: 0, data: null };

// Create a context with configuration options
const context = createContextFactory(initialState, {
  autoLoading: true,
  log: true,
});
```

### Pickers

Pickers are the way to obtain certain parts of the state and listen when they are updated. The return an Observable of the part selected of the state.

```typescript
//Using pick
const count$ = context.pick((state) => state.count); // Observable<number>
const data$ = context.pick((state) => state.data); // Observable<number>
//Using pluck
const count$ = context.plukc("count"); // The string literal of the name of the key of the state object
const count$ = context.pluck("data");
//Using picker
const { count$, data$ } = context.picker; // Is an object of all the parts as Observables.
```

### State

There is two ways to access the current state additionally to the pickers:

```typescript
const state$ = context.state$; // Returns an Observable with the current state value that emits on any change on it.

const { count, data } = context.value; // Returns que current value of the state.
```

### Update methods

Methods that allow update parts or all of the current state. We need to spread the changes in a Redux way.

```typescript

    //update method - Callback with the current state value and must return a new state object.
    addCount() {
        context.update( (state) => {...state, count: state.count + 1})
    }

    //patch method - A method that update a partial part of the state with a new value.
    addTwo() {
        const { count } = context.value;
        context.patch({count: count + 2})
    }

```

### EFFECTS

Effects are the common way to fire async operations (you can also create other type of effects). There are two ways to created them.

#### effect method

The effect method receives a callback that the argumente is an observable of the parameters needed to run the effect and must return an Observable. This is observable is what we commonly named "trigger" because it is what will fire the effect with those parameters. Example:

```typescript
  const apiCall = ... // <-- Method that returns an Observable<string> (a common api call)

  //Create the effect
  const updateUserNameEffect = context.effect( (trigger$: Observable<{id: number, name: string}>) =>
    trigger$.pipe(
      switchMap( ({id, name}) => apiCall(id,name).pipe(
        tap( (userName: string) => context.patch({userName})),
        catchError( ... manage the error)
      ))
    )
  )

  //Run the effect
  updateUserNameEffect({id: 1, name: 'User Name'});

  //Run the effect and do something on success
  //Callback
  updateUserNameEffect({id: 2, name: 'User 2'}, (userName) => {
    console.log("USER NAME CREATED", userName)
  });
  //RxJs
   updateUserNameEffect({id: 2, name: 'User 2'}).subscribe((userName) => {
    console.log("USER NAME CREATED", userName)
  });

  //Manage Error
 //Run the effect and do something on success
  //Callback
  updateUserNameEffect({id: 3, name: 'User 3'}, (userName) => {
    console.log("USER NAME CREATED", userName)
  }, (e) => console.error(e.message));
  //RxJs
   updateUserNameEffect({id: 3, name: 'User 3'}).subscribe((userName) => {
    console.log("USER NAME CREATED", userName)
  }, (e) => console.error(e.message));
```

Running the effect will return an Observable of the type of the returned type data that the trigger maps to. So you can subscribe (or use it with other operators of rxjs) to get the value on success or the error to do something else.
Also if you like the callback way, the effect created method will receive the params as the first argumente, the second is the success callback and the third is the error callback.

#### asyncEffect method

The asyncEffect method is another way to create the effect in a more simplistict way avoiding the use of rxjs when is not needed. Example:

```typescript
const apiCall = ... // <-- Method that returns an Observable<string> (a common api call)

//Creat the effect
const updateUserNameEffect = context.asyncEffect({
  trigger: apiCall,
  success: ({data, params}) => context.patch({userName}),
  error: ({e, params}) => context.patch({userName: null, message: 'Error'}),
  operation: 'reject'
})

 //Run the effect
  updateUserNameEffect.run({id: 1, name: 'User Name'});

  //Run the effect and do something on success
  //Callback
  updateUserNameEffect.run({id: 2, name: 'User 2'}, {
    onSuccess: (userName) => {
      console.log("USER NAME CREATED", userName)
    }
  });
  //RxJs
   updateUserNameEffect({id: 2, name: 'User 2'}).subscribe((userName) => {
    console.log("USER NAME CREATED", userName)
  });

  //Manage Error
 //Run the effect and do something on success
  //Callback
  updateUserNameEffect({id: 3, name: 'User 3'}, {
    onError: (e) => console.error(e.message)}
  });
```

In this case the only part neeeded is trigger, success, error and operation are optional.
The trigger should me a method with params (or not) that returns an Observable, commonly is the api call method.
The params created to run the effect are the one in the trigger method.
The success will receive and object with data, that is the information returned by the api call method and the params if you need them.
The error callback works similar receiving the error instead of the data and the params.
The operation is the way to map the effect racing condition:
switch -> switchMap is the default value
reject -> exhaustMap
concat -> concatMap
merge -> mergeMap
When running the effect you can pass a the second parameters two optional functions, that run onSuccess or onError, the first one receive the data as a parameter and the error function receives the error as a parameter.

### Additional utilities for effects

When running effects you can get two values as a state inside the context that are commonly used when running async effects, the loading and the errors.

#### loading$

loading$ is an Observable<boolean> that is automatically set to true when an effect is running and set to false when all the effects running completes or get an error. This way you can forget to set a loading property for your current context.

#### errors$

Like loading the errors$ is an Observable<Error[]> that contains all the last errors emitted by the effects. When created an effect this arrays set in an index (corresponding on the order created) a null or Error value if the effect throws an error, so you can detect all the errors on your effects, for example if you would like it to map to a message to show to your user or send them to a log.

### clearError

Sometimes is needed to clear the error, this error set the in the Error[] in an index the error to null

### clearAllErrors

Works as clearError but cleans all the Error[].

## API Documentation

- `state$`: An observable to observe the current state.
- `pick`: Pick specific parts of the state and observe changes.
- `pluck`: Pluck a specific key from the state.
- `update`: Update the state with a new version.
- `patch`: Apply a partial update to the state.
- `effect`: Create and run asynchronous effects.
- `asyncEffect`: Create and run asynchronous effects with various operation modes.
- `destroy`: Properly clean up and destroy the context.
- `loading$`: Observe loading states for effects.
- `errors$`: Observe errors from effects.
- `clearError`: Clear a specific error by index.
- `clearAllErrors`: Clear all errors.

## Example

Here's a simple example of how to use Merlin's Apps Context Manager:

```typescript
import { createContextFactory } from 'merlins-apps-context-manager';

// Define your initial state
const initialState = { count: 0, data: null };

// Create a context with configuration options
const context = createContextFactory(initialState, { autoLoading: true, log: true });

// Observe the count property
context.pick((state) => state.count).subscribe((count) => console.log('Count:', count));

// Update the state
context.update((state) => ({ ...state, count: 1 }));

// Run an asynchronous effect
context.asyncEffect({
  trigger: (params) => /* Your asynchronous operation */,
  success: (info) => /* Handle success */,
  error: (e) => /* Handle error */,
}).run(/* Parameters */);
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Merlin's Apps Context Manager** is developed and maintained by [Your Name].

Enjoy using Merlin's Apps Context Manager for efficient state management in your TypeScript projects!
