pragma solidity ^0.4.10;

import '../common/Manageable.sol';
import './VendorBase.sol';
import '../common/ReentryProtected.sol';
import '../helpers/FakeTime.sol';

//Vendor's product for sale
//TODO add return money function
contract Product is Manageable, ReentryProtected, FakeTime {
        
    ///Product id
    uint256 public id;
    ///Name of the product
    string public name;     
    ///Price of one product unit
    uint256 public price;

    ///True if product has limited quantity  
    bool public isLimited;
    ///Max quantity of limited product units
    uint256 public maxUnits;
    ///True if product can be sold by fractions, like 2.5 units
    bool public allowFractions;
    
    ///True if it is possible to buy a product
    bool public isActive;  
    ///From this point a product is buyable (linux timestamp)
    uint256 public startTime;
    ///After this point the product is unbuyable (linux timestamp)
    uint256 public endTime;

    ///How many units already sold
    uint256 public soldUnits;
    ///List of overpays to withdraw
    mapping (address => uint256) public pendingWithdrawals; 
    ///Array of purchase information
    Purchase[] public purchases;

    //only vendor's owner can call some methods
    modifier vendorOnly {require(VendorBase(owner).owner() == msg.sender); _;}

    //Triggers when all payments are successfully done
    event ProductBought(address buyer, uint256 quantity, string clientId);    

    //Purchase information
    struct Purchase {
        uint256 id; //purchase id
        address buyer; //who mad a purchase
        string clientId; //product-specific client id
        uint256 price; //unit price at the moment of purchase
        uint256 paidUnits; //how many units
        bool delivered; //true if Product was delivered
    }

    function Product(
        uint256 productId,
        string productName,
        uint256 unitPriceInWei, 
        bool isProductlimited, 
        uint256 maxProductUnits, 
        bool allowProductFractions,
        uint256 purchaseStartTime,
        uint256 purchaseEndTime
    ) {
        require(purchaseStartTime <= purchaseEndTime);
        
        id = productId;
        name = productName;
        soldUnits = 0;        
        price = unitPriceInWei * 1 wei;
        isLimited = isProductlimited;
        maxUnits = maxProductUnits;
        allowFractions = allowProductFractions;
        isActive = true;
        startTime = purchaseStartTime;
        endTime = purchaseEndTime;
    }

    /**@dev Total amount of purchase transactions */
    function getTotalPurchases() constant returns (uint256) {
        return purchases.length;
    }

    /**@dev Returns information about purchase with given index */
    function getPurchase(uint256 index) constant returns(uint256 pid, string clientId, uint256 paidUnits, bool delivered) {
        return (purchases[index].id, purchases[index].clientId, purchases[index].paidUnits, purchases[index].delivered);
    }

    /**@dev Buy product. Send ether with this function in amount equal to desirable product quantity total price
     * clientId - Buyer's product-specific information. */
    function buy(string clientId) 
        preventReentry 
        payable 
    {
        //check for active
        require(isActive);
        //check maximum length
        //require(bytes(clientId).length <= 255);

        //check time limit        
        require((startTime == 0 || now > startTime) && (endTime == 0 || now < endTime));

        VendorBase vendorInfo = VendorBase(owner);

        var (unitsToBuy, etherToPay, etherToReturn) = calculatePaymentDetails();

        //store overpay to withdraw later
        if (etherToReturn > 0) {
            pendingWithdrawals[msg.sender] += etherToReturn;
        }

        //check if there is something to buy
        require(!isLimited || soldUnits + unitsToBuy <= maxUnits);
        require(unitsToBuy > 0 && etherToPay > 0);        

        //how much to send to both provider and vendor
        uint256 etherToProvider = etherToPay * vendorInfo.providerFeePromille() / 1000;
        uint256 etherToVendor = etherToPay - etherToProvider;
     
        createPurchase(clientId, unitsToBuy);

        soldUnits += unitsToBuy;
        
        vendorInfo.provider().transfer(etherToProvider);
        /* Use 'call' here instead of transfer is intentional. That way we provide all the gas with call. 
         If there is an error then the vendor just won't receive any ether and reimplement its fallback function */
        require(vendorInfo.vendor().call.value(etherToVendor)());
        
        ProductBought(msg.sender, unitsToBuy, clientId);
    }

    /**@dev Call this to return all previous overpays */
    function withdrawOverpay() {
        uint amount = pendingWithdrawals[msg.sender];        
        pendingWithdrawals[msg.sender] = 0;

        msg.sender.transfer(amount);
    } 

    /**@dev Calculates and returns payment details: how many units are bought, 
     what part of ether should be paid and what part should be returned to buyer  */
    function calculatePaymentDetails() 
        internal 
        returns(uint256 unitsToBuy, uint256 etherToPay, uint256 etherToReturn) 
    {
        unitsToBuy = msg.value / price;                                
        etherToReturn = msg.value - unitsToBuy * price;
        etherToPay = msg.value - etherToReturn;
    }

    /**@dev Creates new Purchase record */
    function createPurchase(string clientId, uint256 paidUnits) 
        internal 
    {
        uint256 pid = purchases.length++;        
        Purchase p = purchases[pid];
        p.id = pid;
        p.buyer = msg.sender;
        p.clientId = clientId;
        p.price = price;
        p.paidUnits = paidUnits;
        p.delivered = false;             
    }
    
    /**@dev Mark purchase with given id as delivered */
    function markAsDelivered(uint256 purchaseId) vendorOnly {                
        require(purchaseId < purchases.length);
        require(!purchases[purchaseId].delivered); 

        purchases[purchaseId].delivered = true;
    }

    /**@dev Changes parameters of product */
    function setParams(
        string newName, 
        uint256 newPrice, 
        bool newIsLimited, 
        uint256 newMaxUnits,
        bool newAllowFractions,
        uint256 newStartTime,
        uint256 newEndTime,
        bool newIsActive
    ) 
        vendorOnly
    {
        name = newName;
        price = newPrice;
        isLimited = newIsLimited;
        maxUnits = newMaxUnits;
        allowFractions = newAllowFractions;
        isActive = newIsActive;
        startTime = newStartTime;
        endTime = newEndTime;
    }
}