pragma solidity ^0.4.10;

import './IProductEngine.sol';
import './VendorBase.sol';
import '../common/Owned.sol';
import '../common/ReentryProtected.sol';
import '../upgrade/LibDispatcher.sol';
import '../common/Versioned.sol';

/* 
IProductEngine Library Dispatcher's storage that initially stores return values 
for IProductEngines functions 
*/
contract ProductDispatcherStorage is LibDispatcherStorage {

    function ProductDispatcherStorage(address newLib) public
        LibDispatcherStorage(newLib) {

        //addFunction("getTotalPurchases(IProductEngine.ProductData storage)", 4);
        //addFunction("getPurchase(IProductEngine.ProductData storage, uint32)", 9);
        addFunction("calculatePaymentDetails(IProductEngine.ProductData storage,uint256,bool)", 96);
    }
}

//Vendor's product for sale
//TODO add return money function
//TODO add ratings
contract Product is Owned, Versioned {
    using IProductEngine for IProductEngine.ProductData;

    IProductEngine.ProductData public engine;

    //event FunctionCalled(bytes4 sig, uint32 size, address dest);
    //event ProductBought(address buyer, uint32 unitsToBuy, string clientId);
    event ProductBoughtEx(uint256 indexed id, address indexed buyer, string clientId, uint256 price, uint32 paidUnits);
    event Created(string name, uint32 version, uint256 price, uint32 maxUnits);

    function Product(
        //uint32 productId,
        string productName,
        uint256 unitPriceInWei,         
        uint32 maxProductUnits 
        // bool allowProductFractions,
        // uint256 purchaseStartTime,
        // uint256 purchaseEndTime
    ) public {
        //require(purchaseStartTime <= purchaseEndTime);

        engine.owner = owner;
        //engine.id = productId;
        engine.name = productName;
        engine.soldUnits = 0;        
        engine.price = unitPriceInWei * 1 wei;       
        engine.maxUnits = maxProductUnits;
        //engine.allowFractions = allowProductFractions;
        engine.isActive = true;
        //engine.startTime = purchaseStartTime;
        //engine.endTime = purchaseEndTime;        
        version = 1;
        Created(productName, version, unitPriceInWei, maxProductUnits);
    }
    
    function() public payable {}

    /**@dev 
    Returns total amount of purchase transactions */
    function getTotalPurchases() public constant returns (uint256) {
        return uint256(engine.purchases.length);
    }

    /**@dev 
    Returns information about purchase with given index */
    function getPurchase(uint32 index) 
        public
        constant 
        returns(uint32 id, address buyer, string clientId, uint256 price, uint32 paidUnits, bool delivered, bool badRating) 
    {
        return (
            engine.purchases[index].id,
            engine.purchases[index].buyer,
            engine.purchases[index].clientId,
            engine.purchases[index].price,   
            engine.purchases[index].paidUnits,     
            engine.purchases[index].delivered,
            engine.purchases[index].badRating);
    }

    /**@dev 
    Returns purchase/rating structure index */
    function getUserRatingIndex(address user)
        public
        constant 
        returns (uint256)
    {
        return engine.userRating[user];
    }


    /**@dev 
    Returns pending withdrawal of given buyer */
    function getPendingWithdrawal(address buyer) public constant returns(uint256) {
        return engine.pendingWithdrawals[buyer];
    }    

    /**@dev 
    Buy product. */
    function buy(string clientId, bool acceptLessUnits, uint256 currentPrice)
        public 
    /* preventReentry */
        payable 
    {
        engine.buy(clientId, acceptLessUnits, currentPrice);
    }

    /**@dev Call this to return all previous overpays */
    function withdrawOverpay() public {
        engine.withdrawOverpay();
    }
    
    /**@dev Returns payment details - how much units can be bought, and how much to pay  */
    function calculatePaymentDetails(uint256 weiAmount, bool acceptLessUnits)
        public 
        constant
        returns(uint32 unitsToBuy, uint256 etherToPay, uint256 etherToReturn) 
    {
        return engine.calculatePaymentDetails(weiAmount, acceptLessUnits);        
    }
    
    /**@dev Marks purchase as delivered or undelivered */
    function markAsDelivered(uint32 purchaseId, bool state) public {
        engine.markAsDelivered(purchaseId, state);
    }

    /**@dev Changes parameters of product */
    function setParams(
        string newName, 
        uint256 newPrice,         
        uint32 newMaxUnits,
        // bool newAllowFractions,
        // uint256 newStartTime,
        // uint256 newEndTime,
        bool newIsActive
    ) 
        public 
    {
        engine.setParams(newName, newPrice, newMaxUnits, /*newAllowFractions, newStartTime, newEndTime,*/ newIsActive);        
    }

    function changeRating(bool newLikeState) public {
        engine.changeRating(newLikeState);
    } 

    /**@dev Owned override */
    function transferOwnership(address _newOwner) public ownerOnly {
        super.transferOwnership(_newOwner);
        engine.owner = owner;
    }
}