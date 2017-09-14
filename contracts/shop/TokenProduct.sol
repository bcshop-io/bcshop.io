pragma solidity ^0.4.10;

import './Product.sol';
import '../token/MintableToken.sol';

/// Product that contains a token to distribute or sell
contract TokenProduct is Product {

    uint8 public bronzeRewardTokens;
    uint8 public silverRewardTokens;
    uint8 public goldRewardTokens;
    uint8 public silverRewardDistance; //each x-th investor gets silver reward
    uint8 public goldRewardDistance; //each x-th investor gets gold reward

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
        uint256 purchaseEndTime,
        uint8 bronzeReward,
        uint8 silverReward,
        uint8 goldReward,
        uint8 silverDistance,
        uint8 goldDistance)
        //set base product price to 0 as it doesn't matter
        Product(productId, productName, 0, true, maxProductUnits, false, purchaseStartTime, purchaseEndTime)
    {
        token = tokenToSell;
        bronzeRewardTokens = bronzeReward;
        silverRewardTokens = silverReward;
        goldRewardTokens = goldReward;
        silverRewardDistance = silverDistance;
        goldRewardDistance = goldDistance;
    }

    /**@dev Product override */
    function calculatePaymentDetails(uint256 weiAmount, bool acceptLessUnits)         
        returns(uint256 unitsToBuy, uint256 etherToPay, uint256 etherToReturn) 
    {
        etherToReturn = 0;
        etherToPay = weiAmount;        
        unitsToBuy = soldUnits < maxUnits ? 1 : 0;
    }

    /**@dev Product override */
    function createPurchase(string clientId, uint256 paidUnits) 
        internal 
    {
        require (buyers[msg.sender] == 0); //no multiple purchases;

        super.createPurchase(clientId, paidUnits);

        uint256 tokenAmount = bronzeRewardTokens;
        if (purchases.length % goldRewardDistance == 0) {
            tokenAmount = goldRewardTokens;
        } else if (purchases.length % silverRewardDistance == 0) {
            tokenAmount = silverRewardTokens;
        }

        tokenAmount = token.getRealTokenAmount(tokenAmount); //considering decimals

        token.mint(msg.sender, tokenAmount);
        buyers[msg.sender] = safeAdd(buyers[msg.sender], tokenAmount);
    }
}