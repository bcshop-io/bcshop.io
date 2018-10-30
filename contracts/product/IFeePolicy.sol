pragma solidity ^0.4.24;


/**Abstraction of fee policy */
contract IFeePolicy {

    /**@dev Calculates base fee amount and escrow fee amount.      
    vendor - product owner
    payment - total wei paid for this product .
    Returns base fee amount, escrow fee amount */
    function calculateFeeAmount(address vendor, uint256 productId, uint256 payment) 
        public 
        returns(uint256, uint256);

    /**@dev Sends fees to service provider and affiliate if it exists    
    Vendor is vendor address which product was purchased */
    function sendFee(address vendor) public payable;
}