pragma solidity ^0.4.24;

/**@dev abstraction to Escrow-related information provider  */
contract IEscrow {

    //
    // Methods

    function defaultEscrow() public pure returns (address) {}

    /**@dev returns product's escrow currently used */
    function getProductEscrow(uint256) public view returns (address);
    /**@dev returns product's escrow fee */
    function getProductEscrowFee(uint256) public view returns (uint16);    
    /**@dev returns product's escrow hold time */
    function getProductEscrowHoldTime(uint256) public view returns(uint256);    
}