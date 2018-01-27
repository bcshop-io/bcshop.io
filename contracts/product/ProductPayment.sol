pragma solidity ^0.4.18;

import "../common/SafeMathLib.sol";
import "../common/Manageable.sol";
import "./IProductStorage.sol";
import "./IFeePolicy.sol";

/**@dev This contact accepts payments for products and transfers ether to all the parties */
contract ProductPayment is Manageable {

    using SafeMathLib for uint256;

    //
    //Events

    //emitted during purchase process. Id is 0-based index of purchase in the engine.purchases array
    event ProductBought(address indexed buyer, string clientId, uint256 price, uint256 paidUnits);



    //
    // Storage data
    IProductStorage productStorage;
    IFeePolicy defaultFeePolicy;


    //
    // Modifiers



    //
    // Methods

    function ProductPayment(IProductStorage _productStorage, IFeePolicy _defaultFeePolicy) public {
        productStorage = _productStorage;
        defaultFeePolicy = _defaultFeePolicy;
    }
    
    /**@dev 
    Calculates and returns payment details: how many units are bought, 
     what part of ether should be paid and what part should be returned to buyer  */
    function calculatePaymentDetails(uint256 productId, uint256 weiAmount, bool acceptLessUnits) 
        public
        constant
        returns(uint256 unitsToBuy, uint256 etherToPay, uint256 etherToReturn) 
    {
        var (price, maxUnits, soldUnits, denominator) = productStorage.getProductData(productId);

        unitsToBuy = weiAmount.safeMult(denominator).safeDiv(price);
        
        //if product is limited and it's not enough to buy, check acceptLessUnits flag
        if (maxUnits > 0 && soldUnits + unitsToBuy > maxUnits) {
            if (acceptLessUnits) {
                unitsToBuy = maxUnits.safeSub(soldUnits);
            } else {
                unitsToBuy = 0; //set to 0 so it will fail in buy() function later
            }
        }
        
        etherToReturn = weiAmount.safeSub(price.safeMult(unitsToBuy).safeDiv(denominator));
        etherToPay = weiAmount.safeSub(etherToReturn);
    } 

    /**@dev 
    Buy product. Send ether with this function in amount equal to desirable product quantity total price */
    function buy(
        uint256 productId, 
        address buyer,
        string clientId, 
        bool acceptLessUnits, 
        uint256 currentPrice
    ) 
        public
    {
        require(productId < productStorage.getTotalProducts());
        uint256 price = productStorage.getProductPrice(productId);

        //check for active flag and valid price
        require(productStorage.isProductActive(productId) && currentPrice == price); 

        //how much units do we buy
        var (unitsToBuy, etherToPay, etherToReturn) = calculatePaymentDetails(productId, msg.value, acceptLessUnits);

        //check if there is enough units to buy
        require(unitsToBuy > 0);

        ////store overpay to withdraw later
        // if (etherToReturn > 0) {
        //     self.pendingWithdrawals[msg.sender] = self.pendingWithdrawals[msg.sender].safeAdd(etherToReturn);
        // }
        sendEther(productId, etherToPay);
        
        productStorage.addPurchase(productId, buyer, price, unitsToBuy, clientId);
        // uint256 pid = self.purchases.length++;
        // IProductEngine.Purchase storage p = self.purchases[pid];
        // p.id = pid;

        // if (self.userRating[msg.sender] == 0) {
        //     self.userRating[msg.sender] = pid + 1;
        // }

        // self.soldUnits = self.soldUnits + unitsToBuy;
        


        // ProductBoughtEx(self.purchases.length - 1, msg.sender, clientId, self.price, unitsToBuy);
        //ProductBought(msg.sender, uint32(unitsToBuy), clientId);
    }


    /**@dev Sends ether to vendor and provider */
    function sendEther(uint256 productId, uint256 etherToPay) internal {
        var (wallet, feePolicy, postProcessor) = productStorage.getProductPaymentData(productId);
        
        if (feePolicy == 0) {
            feePolicy = defaultFeePolicy;
        }
        
        uint256 etherToProvider;
        uint256 etherToVendor;
        if (etherToPay > 0) {
            etherToProvider = IFeePolicy(feePolicy).getFeeAmount(etherToPay);        
            etherToVendor = etherToPay.safeSub(etherToProvider);
            
            IFeePolicy(feePolicy).sendFee.value(etherToProvider)();
            wallet.transfer(etherToVendor);
        }
    }
    /**@dev 
    Call this to return all previous overpays */
    // function withdrawOverpay(IProductEngine.ProductData storage self) public {
    //     uint amount = self.pendingWithdrawals[msg.sender];        
    //     self.pendingWithdrawals[msg.sender] = 0;

    //     if (!msg.sender.send(amount)) {
    //         self.pendingWithdrawals[msg.sender] = amount;
    //     }
    // }

}