pragma solidity ^0.4.24;

/**@dev EscrowStorage abstraction */
contract IEscrowStorage {

    //
    // Methods
        
    function isEscrow(address escrow) public view returns (bool);
    function isEscrowActive(address escrow) public view returns (bool);
    function isEscrowBanned(address escrow) public view returns (bool); 

    function getEscrowCurrentFee(address) public view returns(uint16);

    function getProductEscrow(uint256) public view returns (address);
    function getProductEscrowFee(uint256) public view returns (uint16);    
    function getProductEscrowHoldTime(uint256) public view returns(uint256);
    
    /**@dev Creates new EscrowInfo record.  */
    function addEscrow(address escrow, uint16 feePermille) public;

    /**@dev Edits escrow information. */
    function editEscrow(address escrow, bool state, uint16 feePermille) public;
    
    /**@dev Sets escrow for specified product */ 
    function setProductEscrow(uint256 productId, address escrow, uint16 escrowFee, uint256 holdTimeSeconds) public;
}