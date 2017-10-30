pragma solidity ^0.4.10;

import './VendorBase.sol';
import './IProductEngine.sol';
import '../common/SafeMathLib.sol';

/*
ProductEngine that performs actual work */
library ProductEngine {

    using SafeMathLib for uint256;

    //event ProductBought(address buyer, uint32 unitsToBuy, string clientId);
    //event that is emitted during purchase process. Id is 0-based index of purchase in the engine.purchases array
    event ProductBoughtEx(uint256 indexed id, address indexed buyer, string clientId, uint256 price, uint32 paidUnits);

    /**@dev 
    Calculates and returns payment details: how many units are bought, 
     what part of ether should be paid and what part should be returned to buyer  */
    function calculatePaymentDetails(IProductEngine.ProductData storage self, uint256 weiAmount, bool acceptLessUnits) 
        public
        constant
        returns(uint32 unitsToBuy, uint256 etherToPay, uint256 etherToReturn) 
    {        
        unitsToBuy = uint32(weiAmount.safeDiv(self.price));
        //if product is limited and it's not enough to buy, check acceptLessUnits flag
        if (self.maxUnits > 0 && self.soldUnits + unitsToBuy > self.maxUnits) {
            if (acceptLessUnits) {
                unitsToBuy = self.maxUnits - self.soldUnits;
            } else {
                unitsToBuy = 0; //set to 0 so it will fail in buy() function later
            }
        }
        
        etherToReturn = weiAmount.safeSub(self.price.safeMult(unitsToBuy));
        etherToPay = weiAmount.safeSub(etherToReturn);
    } 

    /**@dev 
    Buy product. Send ether with this function in amount equal to desirable product quantity total price */
    function buy(
        IProductEngine.ProductData storage self, 
        string clientId, 
        bool acceptLessUnits, 
        uint256 currentPrice
    ) 
        public
    {
    }

    /**@dev 
    Call this to return all previous overpays */
    function withdrawOverpay(IProductEngine.ProductData storage self) public {
        uint amount = self.pendingWithdrawals[msg.sender];        
        self.pendingWithdrawals[msg.sender] = 0;

        if (!msg.sender.send(amount)) {
            self.pendingWithdrawals[msg.sender] = amount;
        }
    }
    
    /**@dev 
    Marks purchase with given id as delivered or not */
    function markAsDelivered(IProductEngine.ProductData storage self, uint32 purchaseId, bool state) public {
        require(VendorBase(self.owner).owner() == msg.sender);
        require(purchaseId < self.purchases.length);
        self.purchases[purchaseId].delivered = state;
    }

    /**@dev 
    Changes parameters of product */
    function setParams(
        IProductEngine.ProductData storage self,
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
        require(VendorBase(self.owner).owner() == msg.sender);

        self.name = newName;
        self.price = newPrice;
        self.maxUnits = newMaxUnits;
        /*self.allowFractions = newAllowFractions;
        self.startTime = newStartTime;
        self.endTime = newEndTime;*/
        self.isActive = newIsActive;
    }

    /**@dev Creates new Purchase record */
    // function createPurchase(IProductEngine.ProductData storage self, string clientId, uint32 paidUnits) 
    //     internal 
    // {
    //     // uint32 pid = uint32(self.purchases.length++);
    //     // IProductEngine.Purchase storage p = self.purchases[pid];
    //     //p.id = pid;
    //     //p.buyer = msg.sender;
    //     //p.clientId = clientId;
    //     //p.price = self.price;
    //     //p.paidUnits = paidUnits;
    //     //p.delivered = false;

    //     // if (self.userRating[msg.sender] == 0) {
    //     //     self.userRating[msg.sender] = pid + 1;
    //     // }
    //     // ProductBoughtEx(pid, msg.sender, clientId, self.price, paidUnits);

    //     self.purchases.length++;
    //     self.purchases[self.purchases.length - 1].price = self.price;
    //     if (self.userRating[msg.sender] == 0) {
    //         self.userRating[msg.sender] = self.purchases.length;
    //     }
    //     ProductBoughtEx(self.purchases.length, msg.sender, clientId, self.price, paidUnits);
    // }

    /**@dev Changes product rating. */
    function changeRating(IProductEngine.ProductData storage self, bool newLikeState) public {
        require(self.userRating[msg.sender] > 0);

        self.purchases[self.userRating[msg.sender] - 1].badRating = !newLikeState;
    }
}





