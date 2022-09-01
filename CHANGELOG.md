# Changes in 0.0.1

Released 09/01/2022
First publication of context used in test projects at Merlin's Hut

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
