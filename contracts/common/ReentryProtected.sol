pragma solidity ^0.4.10;

/** @dev Mutex based reentry protection protect. 
    based on https://github.com/o0ragman0o/ReentryProtected/blob/master/ReentryProtected.sol */
contract ReentryProtected {
    // The reentry protection state mutex.
    bool _reMutex;

    // This modifier can be used on functions with external calls to
    // prevent reentry attacks.
    // Constraints:
    //   Protected functions must have only one point of exit.
    //   Protected functions cannot use the `return` keyword
    //   Protected functions return values must be through return parameters.
    modifier preventReentry() {
        require(!_reMutex);
        _reMutex = true;
        _;
        delete _reMutex;
        return;
    }

    // This modifier can be applied to public access state mutation functions
    // to protect against reentry if a `preventReentry` function has already
    // set the mutex. This prevents the contract from being reenter under a
    // different memory context which can break state variable integrity.
    modifier noReentry() {
        require(!_reMutex);
        _;
    }
}