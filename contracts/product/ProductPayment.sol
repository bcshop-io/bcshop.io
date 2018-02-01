pragma solidity ^0.4.18;

import "../common/SafeMathLib.sol";
import "../common/Manageable.sol";
import "./IProductStorage.sol";
import "./IFeePolicy.sol";
import "./IPurchaseHandler.sol";

/**@dev This contact accepts payments for products and transfers ether to all the parties */
contract ProductPayment is Manageable {

    using SafeMathLib for uint256;

    //
    //Events

    //emitted during purchase process. Id is 0-based index of purchase in the engine.purchases array
    event ProductBought(address indexed buyer, uint256 indexed productId, string clientId, uint256 price, uint256 paidUnits);
    event OverpayStored(address indexed buyer, uint256 indexed productId, uint256 amount);


    //
    // Storage data
    IProductStorage public productStorage;
    IFeePolicy public defaultFeePolicy;
    mapping (address => uint256) public pendingWithdrawals; 


    //
    // Modifiers



    //
    // Methods

    function ProductPayment(IProductStorage _productStorage, IFeePolicy _defaultFeePolicy) public {
        productStorage = _productStorage;
        defaultFeePolicy = _defaultFeePolicy;
    }
    
    /**@dev Calculates and returns payment details: how many units are bought, 
     what part of ether should be paid and what part should be returned to buyer  */
    function calculatePaymentDetails(uint256 productId, uint256 weiAmount, bool acceptLessUnits) 
        public
        constant
        returns(uint256 unitsToBuy, uint256 etherToPay, uint256 etherToReturn) 
    {
        var (price, maxUnits, soldUnits) = productStorage.getProductData(productId);

        unitsToBuy = weiAmount.safeDiv(price);
        
        //if product is limited and it's not enough to buy, check acceptLessUnits flag
        if (maxUnits > 0 && soldUnits + unitsToBuy > maxUnits) {
            if (acceptLessUnits) {
                unitsToBuy = maxUnits.safeSub(soldUnits);
            } else {
                unitsToBuy = 0; //set to 0 so it will fail in buy() function later
            }
        }
        
        etherToReturn = weiAmount.safeSub(price.safeMult(unitsToBuy));
        etherToPay = weiAmount.safeSub(etherToReturn);
    } 

    /**@dev Buys product. Send ether with this function in amount equal to 
    desirable product quantity total price. Buyer explicitly passed as parameter 
    as that leaves opportunity for another contract to buy product for someone else */
    function buy(
        uint256 productId, 
        address buyer,
        string clientId, 
        bool acceptLessUnits, 
        uint256 currentPrice
    ) 
        public
        payable
    {
        require(productId < productStorage.getTotalProducts());
        uint256 price = productStorage.getProductPrice(productId);

        //check for active flag and valid price
        require(productStorage.isProductActive(productId) && currentPrice == price); 

        //how much units do we buy
        var (unitsToBuy, etherToPay, etherToReturn) = calculatePaymentDetails(productId, msg.value, acceptLessUnits);

        //check if there is enough units to buy
        require(unitsToBuy > 0);

        //store overpay to withdraw later
         if (etherToReturn > 0) {
            pendingWithdrawals[buyer] = pendingWithdrawals[buyer].safeAdd(etherToReturn);
            OverpayStored(buyer, productId, etherToReturn);
        }

        var (wallet, feePolicy) = productStorage.getProductPaymentData(productId);
        
        sendEther(wallet, IFeePolicy(feePolicy), etherToPay);
        productStorage.addPurchase(productId, buyer, price, unitsToBuy, clientId);

        // TODO Rating
        ProductBought(buyer, productId, clientId, price, unitsToBuy);
    }

    /**@dev Call this to return all previous overpays */
    function withdrawOverpay() public {
        uint amount = pendingWithdrawals[msg.sender];        
        require(amount > 0);

        pendingWithdrawals[msg.sender] = 0;
        msg.sender.transfer(amount);
    }
    
    /**@dev Sends ether to vendor and provider */
    function sendEther(address wallet, IFeePolicy feePolicy, uint256 etherToPay) internal {
        if (address(feePolicy) == 0x0) {
            feePolicy = defaultFeePolicy;
        }
        
        uint256 etherToProvider;
        uint256 etherToVendor;
        if (etherToPay > 0) {
            etherToProvider = feePolicy.getFeeAmount(etherToPay);        
            etherToVendor = etherToPay.safeSub(etherToProvider);
            
            feePolicy.sendFee.value(etherToProvider)();
            wallet.transfer(etherToVendor);
        }
    }
}