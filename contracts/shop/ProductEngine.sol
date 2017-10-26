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
        //check for active flag and valid price
        require(self.isActive && currentPrice == self.price);        

        //check time limit        
        //require((self.startTime == 0 || now > self.startTime) && (self.endTime == 0 || now < self.endTime));

        //how much units do we buy
        var (unitsToBuy, etherToPay, etherToReturn) = calculatePaymentDetails(self, msg.value, acceptLessUnits);

        //store overpay to withdraw later
        if (etherToReturn > 0) {
            self.pendingWithdrawals[msg.sender] = self.pendingWithdrawals[msg.sender].safeAdd(etherToReturn);
        }

        //check if there is enough units to buy
        require(unitsToBuy > 0);

        //how much to send to both provider and vendor
        VendorBase vendorInfo = VendorBase(self.owner);
        uint256 etherToProvider;
        uint256 etherToVendor;
        if (etherToPay > 0) {
            etherToProvider = etherToPay.safeMult(vendorInfo.providerFeePromille()) / 1000;        
            etherToVendor = etherToPay.safeSub(etherToProvider);
        } else {
            etherToProvider = 0;
            etherToVendor = 0;
        }
     
        //createPurchase(self, clientId, uint32(unitsToBuy));
        //self.purchases.length++;        
        //if it is the first purchase of msg.sender, write price value so to add to rating        
        //that way unrated purchases will store price = 0
        //if (self.userRating[msg.sender] == 0) {
        //    self.purchases[self.purchases.length - 1].price = self.price;
        //    self.userRating[msg.sender] = self.purchases.length;
        //} 

        uint32 pid = uint32(self.purchases.length++);
        IProductEngine.Purchase storage p = self.purchases[pid];
        p.id = pid;
        p.buyer = msg.sender;
        p.clientId = clientId;
        p.price = self.price;
        p.paidUnits = unitsToBuy;
        p.delivered = false;

        if (self.userRating[msg.sender] == 0) {
            self.userRating[msg.sender] = pid + 1;
        }

        self.soldUnits = uint32(self.soldUnits + unitsToBuy);
        
        vendorInfo.provider().transfer(etherToProvider);        
        vendorInfo.vendor().transfer(etherToVendor);

        ProductBoughtEx(self.purchases.length - 1, msg.sender, clientId, self.price, uint32(unitsToBuy));
        //ProductBought(msg.sender, uint32(unitsToBuy), clientId);
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





