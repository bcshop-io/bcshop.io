pragma solidity ^0.4.18;

contract IRevokedStorage {

    function revokedPurchases(uint256 productId, uint256 purchaseId) public view returns(bool) {}
    function escrowFee(uint256 productId, uint256 purchaseId) public view returns(uint256) {}
    function setRevokedFlag(uint256 productId, uint256 purchaseId, bool revoked) public;
    function saveEscrowFee(uint256 productId, uint256 purchaseId, uint256 fee) public;
}