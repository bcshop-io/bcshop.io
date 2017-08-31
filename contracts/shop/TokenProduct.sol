pragma solidity ^0.4.10;

import './Product.sol';
import '../token/MintableToken.sol';
import '../helpers/FakeTime.sol';

/// Product that contains a token to distribute or sell
contract TokenProduct is Product {

    uint8 constant public BRONZE_REWARD = 1;
    uint8 constant public SILVER_REWARD = 10;
    uint8 constant public GOLD_REWARD = 100;
    uint8 constant public SILVER_REWARD_CHANCE = 3;
    uint8 constant public GOLD_REWARD_CHANCE = 5;

    /**@dev List of buyers to prevent multiple purchases */
    mapping (address => uint256) public buyers;

    /**@dev A token to sell. */
    MintableToken public token;
    
    function TokenProduct(
        MintableToken tokenToSell,
        uint256 productId,
        string productName,
        uint256 maxProductUnits,
        uint256 purchaseStartTime,
        uint256 purchaseEndTime)
        //set base product price to 0 as it doesn't matter
        Product(productId, productName, 0, true, maxProductUnits, false, purchaseStartTime, purchaseEndTime)
    {
        token = tokenToSell;
    }

    function calculatePaymentDetails() 
        internal 
        returns(uint256 unitsToBuy, uint256 etherToPay, uint256 etherToReturn) 
    {
        etherToReturn = 0;
        etherToPay = msg.value;
        unitsToBuy = 1;
    }

    function createPurchase(string clientId, uint256 paidUnits) 
        internal 
    {
        //require (buyers[msg.sender] == 0); //no multiple purchases;

        super.createPurchase(clientId, paidUnits);

        uint256 tokenAmount = BRONZE_REWARD;
        if (purchases.length % GOLD_REWARD_CHANCE == 0) {
            tokenAmount = GOLD_REWARD;
        } else if (purchases.length % SILVER_REWARD_CHANCE == 0) {
            tokenAmount = SILVER_REWARD;
        }

        token.mint(msg.sender, tokenAmount);
        buyers[msg.sender] += tokenAmount;
    }
}