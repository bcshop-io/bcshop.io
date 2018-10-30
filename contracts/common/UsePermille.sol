pragma solidity ^0.4.24;

contract UsePermille {


    //
    // Storage data
    uint16 constant MAXPERMILLE = 1000;


    //
    // Modifiers
    modifier validPermille(uint16 value) {
        require(value <= MAXPERMILLE);
        _;
    }

    //
    // Methods

    constructor() public {
    }
}