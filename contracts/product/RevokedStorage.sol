pragma solidity ^0.4.18;

import "../common/Manageable.sol";
import "./IRevokedStorage.sol";



/**
* Stores revoked flag and escrow fee paid (to refund while revoking)
*/
contract RevokedStorage is IRevokedStorage, Manageable {

    //
    // Events
    event RevokedFlagSet(uint256 indexed productId, uint256 indexed purchaseId, bool state);
    event EscrowFeeSet(uint256 indexed productId, uint256 indexed purchaseId, uint256 fee);


    //
    // Storage data

    //[productId, purchaseId] => <true if revoked> 
    mapping(uint256=>mapping(uint256=>bool)) public revokedPurchases;

    //[productId, purchaseId] => <escrow fee paid> 
    mapping(uint256=>mapping(uint256=>uint256)) public escrowFee;


    //
    // Methods

    constructor() public {
    }

    //Sets revoked flag for specified purchase
    function setRevokedFlag(uint256 productId, uint256 purchaseId, bool revoked) 
        public 
        managerOnly 
    {
        revokedPurchases[productId][purchaseId] = revoked;
        emit RevokedFlagSet(productId, purchaseId, revoked);
    }

    //Saves paid escrow fee for specified purchase
    function saveEscrowFee(uint256 productId, uint256 purchaseId, uint256 fee) 
        public 
        managerOnly 
    {
        escrowFee[productId][purchaseId] = fee;
        emit EscrowFeeSet(productId, purchaseId, fee);
    }
}