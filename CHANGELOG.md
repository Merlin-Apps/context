# Changes in 1.0.0

- [#7](https://github.com/Merlin-Apps/context/issues/7) - Access the actual value of the state.
- [#6](https://github.com/Merlin-Apps/context/issues/6) - New method called asyncEffect to easily create an effect without using rxjs.
- [#5](https://github.com/Merlin-Apps/context/issues/5) - Improved the effects that correctly calls success and error callbacks and not break the effect subscription.
- [#4](https://github.com/Merlin-Apps/context/issues/4) - Improved loadings and errors system.
- [#3](https://github.com/Merlin-Apps/context/issues/3) - Improved usage of state and picker methods

- [#1](https://github.com/Merlin-Apps/context/issues/1) - Returns functions on effect don't return the error as a value.
- [#2](https://github.com/Merlin-Apps/context/issues/2) - Updated now throws error when passed attributes that not exists in state. This is produces because of [Type compatibilty](https://www.typescriptlang.org/docs/handbook/type-compatibility.html#starting-out) in typescript, was needed to check the attributes types.

# Changes in 0.2.0

Released 09/05/2022
Correction of bugs.

[npm - @merlinshut/context@0.2.0](https://www.npmjs.com/package/@merlinshut/context/v/0.2.0)

### Breaking changes

- Creation of context parameters changed. The object as parameter was replaced by two parameters. First parameter is the initialState, second parameter is an object with the configs properties (autoLoading and log)

### Depecrations

- updateP: Now is name patch, works the same way as before. Use patch instead of updateP, updateP will be removed in future versions.

### Bug Fixes

- [#1](https://github.com/Merlin-Apps/context/issues/1) - Returns functions on effect don't return the error as a value.
- [#2](https://github.com/Merlin-Apps/context/issues/2) - Updated now throws error when passed attributes that not exists in state. This is produces because of [Type compatibilty](https://www.typescriptlang.org/docs/handbook/type-compatibility.html#starting-out) in typescript, was needed to check the attributes types.

### New Features

- effect: now has a third parameter that receives a return error function as callback to manage the error where the effect is fired. Similar to return function parameter.
- effect: Now returns correctly an observable to manage the returns values of the effect. Could be used for ex. to combine with other observables or effects.

### Development

- added vitest and oberserverspy to create unit testing for the context factory.

# Changes in 0.0.1

Released 09/01/2022
First publication of context used in test projects at Merlin's Hut

[npm - @merlinshut/context@0.0.1](https://www.npmjs.com/package/@merlinshut/context/v/0.0.1)

### Includes:

- createContextFactory: The method to create the context.
- Pick: Like a selector utility to get a part of the state
- Pluck: To get a part of the state by object key
- Picker: An object created with all keys of the state as pick (Observables)
- update: A method to update the state
- updateP: A method to update the state passing a partial state
- effect: Functionallity to create side effects observables
- loading and autoloading: Included in the state is a loading attribute that fires when an effect is called if autoloading is set to true in context creation
- emitError and clearError: methods to update the error state included in the context
- error: An attribute with the error emited by emitError
- events: **\*Use at discretion\*** An object contained all keys of the state that fires whenever the state changes.
- state: The current state of the context
- destroy: A method that must be called whenever you need to clean all subcritions.
- startLoading, stopLoading: methods to start and stop to loading

# Changes in 1.0.1

Released 30/10/2023
First release stable version of context

[npm - @merlinshut/context@1.0.1](https://www.npmjs.com/package/@merlinshut/context/v/1.0.1)

### Includes

- **Observable State**: Easily manage and observe the state of your application using RxJs observables.
- **Auto-Loading**: Enable auto-loading for effects to simplify asynchronous operations.
- **Logging**: Enable logging for development mode to help with debugging.
- **Error Handling**: Automatically catch and manage errors for your effects.
- **Flexible Pickers**: Pick and observe specific parts of your state using pickers.
- **Update and Patch**: Modify your state with update and patch functions.
- **Clean and Destroy**: Properly clean up and destroy your context when it's no longer needed.
- **Async Effects**: Create and run asynchronous effects with success and error handling.
- **Multiple Operation Modes**: Choose from "switch," "reject," "concat," or "merge" for effect operations to manage racing conditions.


# Changes in 1.0.2

Released 01/06/2024
Bug fixing minor release.

- Updated vitest dev dependency to latest to shutdown the git hub security bot
- [Bug Fix #8](https://github.com/Merlin-Apps/context/issues/8) - Resolved 

[npm - @merlinshut/context@1.0.1](https://www.npmjs.com/package/@merlinshut/context/v/1.0.2)
