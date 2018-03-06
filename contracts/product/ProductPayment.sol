pragma solidity ^0.4.18;

import "../common/SafeMathLib.sol";
import "../common/Manageable.sol";
import "../token/IERC20Token.sol";
import "./IProductStorage.sol";
import "./IFeePolicy.sol";
import "./IPurchaseHandler.sol";
import "./IDiscountPolicy.sol";
import "./IBancorConverter.sol";

/**@dev This contact accepts payments for products and transfers ether to all the parties */
contract ProductPayment is Manageable {

    using SafeMathLib for uint256;

    //
    //Events

    //emitted during purchase process. Id is 0-based index of purchase in the engine.purchases array
    event ProductBought(address indexed buyer, uint256 indexed productId, string clientId, uint256 price, uint256 paidUnits, uint256 discount);
    event OverpayStored(address indexed buyer, uint256 indexed productId, uint256 amount);


    //
    // Storage data

    IProductStorage public productStorage;
    IFeePolicy public feePolicy;
    IDiscountPolicy public discountPolicy;
    //token that can be used as payment tool
    IERC20Token public token;
    // Bancor quick converter to convert BCS to ETH. Important: this is NOT a BancorConverter contract.
    // This must be set to the corresponding BancorConverter.extensions.quickConverter   
    IBancorConverter public converter;
    // escrow payment hold time in seconds 
    uint256 public escrowHoldTime; 
    address[] public convertPath;

    //
    // Methods

    function ProductPayment(
        IProductStorage _productStorage, 
        IFeePolicy _feePolicy, 
        IDiscountPolicy _discountPolicy,
        IERC20Token _token,
        IBancorConverter _converter,
        uint256 _escrowHoldTime
    ) {
        productStorage = _productStorage;
        feePolicy = _feePolicy;
        discountPolicy = _discountPolicy;
        token = _token;
        converter = _converter;
        escrowHoldTime = _escrowHoldTime;
    }

    //allows to receive direct ether transfers
    function() payable {}
    
    /**@dev Sets convert path for changing BCS to ETH through Bancor */
    function setConvertParams(address[] _convertPath) public ownerOnly {
        convertPath = _convertPath;
    }

    /**@dev Changes parameters */
    function setParams(
        IProductStorage _productStorage,
        IFeePolicy _feePolicy, 
        IDiscountPolicy _discountPolicy,
        IERC20Token _token,
        IBancorConverter _converter,
        uint256 _escrowHoldTime
    ) 
        public 
        ownerOnly 
    {
        productStorage = _productStorage;
        feePolicy = _feePolicy;
        discountPolicy = _discountPolicy;
        token = _token;
        converter = _converter;
        escrowHoldTime = _escrowHoldTime;
    }
    
    function getUnitsToBuy(uint256 productId, uint256 units, bool acceptLessUnits) public constant returns(uint256) {
        var (price, maxUnits, soldUnits) = productStorage.getProductData(productId);

        //if product is limited and it's not enough to buy, check acceptLessUnits flag
        if (maxUnits > 0 && soldUnits.safeAdd(units) > maxUnits) {
            if (acceptLessUnits) {
                return maxUnits.safeSub(soldUnits);
            } else {
                return 0; //set to 0 so it will fail later
            }
        } else {
            return units;
        }
    }

    /**@dev Returns true if vendor profit can be withdrawn */
    function canWithdrawPending(uint256 productId, uint256 purchaseId) public constant returns(bool) {
        var (customer, fee, profit, timestamp) = productStorage.getEscrowData(productId, purchaseId);
        IProductStorage.PurchaseState state = productStorage.getPurchase(productId, purchaseId);

        return state == IProductStorage.PurchaseState.Pending 
            || (state == IProductStorage.PurchaseState.Paid && timestamp + escrowHoldTime <= now);
    }


    /**@dev Buys product. Send ether with this function in amount equal to 
    desirable product units * current price. */
    function buyWithEth(
        uint256 productId,  
        uint256 units,         
        string clientId, 
        bool acceptLessUnits, 
        uint256 currentPrice
    ) 
        public
        payable
    {
        buy(msg.value, productId, units, clientId, acceptLessUnits, currentPrice);        
    }


    /**@dev Buys product using BCS tokens as a payment. 
    1st parameter is the amount of tokens that will be converted via bancor. This can be calculated off-chain.
    Tokens should be approved for spending by this contract */
    function buyWithTokens(
        uint256 tokens,
        uint256 productId,  
        uint256 units,       
        string clientId, 
        bool acceptLessUnits, 
        uint256 currentPrice
    ) 
        public
    {
        //transfer tokens to this contract for exchange
        token.transferFrom(msg.sender, this, tokens);

        //exchange through Bancor
        uint256 ethAmount = converter.convert(convertPath, tokens, 1);

        //use received ether for payment
        buy(ethAmount, productId, units, clientId, acceptLessUnits, currentPrice);
    }    

    /**@dev Make a complain on purchase, only customer can call this method */
    function complain(uint256 productId, uint256 purchaseId) public {
        //check product's escrow option
        require(productStorage.isEscrowUsed(productId));

        var (customer, fee, profit, timestamp) = productStorage.getEscrowData(productId, purchaseId);
        
        //check purchase current state, valid customer and time limits
        require(
            productStorage.getPurchase(productId, purchaseId) == IProductStorage.PurchaseState.Paid && 
            customer == msg.sender &&
            timestamp + escrowHoldTime > now
        );
        
        //change purchase status
        productStorage.changePurchase(productId, purchaseId, IProductStorage.PurchaseState.Complain);        
    }

    /**@dev Resolves a complain on specific purchase. 
    If cancelPayment is true, payment returns to customer; otherwise - to the vendor */
    function resolve(uint256 productId, uint256 purchaseId, bool cancelPayment) public managerOnly {
        
        //check purchase state
        require(productStorage.getPurchase(productId, purchaseId) == IProductStorage.PurchaseState.Complain);
        
        var (customer, fee, profit, timestamp) = productStorage.getEscrowData(productId, purchaseId);
        
        if (cancelPayment) {
            //change state first, then transfer to customer
            productStorage.changePurchase(productId, purchaseId, IProductStorage.PurchaseState.Canceled);            
            customer.transfer(fee.safeAdd(profit));
        } else {
            //change state first, then transfer fee to the provider. vendor should call withdrawPending
            productStorage.changePurchase(productId, purchaseId, IProductStorage.PurchaseState.Pending);
        }
    }

    /**@dev transfers pending profit to the vendor */
    function withdrawPending(uint256 productId, uint256 purchaseId) public {
        var (customer, fee, profit, timestamp) = productStorage.getEscrowData(productId, purchaseId);

        //check owner
        require(msg.sender == productStorage.getProductOwner(productId));
        //check withdrawability
        require(canWithdrawPending(productId, purchaseId));

        //change state first, then transfer funds
        productStorage.changePurchase(productId, purchaseId, IProductStorage.PurchaseState.Finished);
        productStorage.getVendorWallet(msg.sender).transfer(profit);
        feePolicy.sendFee.value(fee)();
    }

    function buy(
        uint256 ethAmount,
        uint256 productId,  
        uint256 units,        
        string clientId, 
        bool acceptLessUnits, 
        uint256 currentPrice
    ) 
        internal        
    {
        require(productId < productStorage.getTotalProducts());        
        uint256 price = productStorage.getProductPrice(productId);

        //check for active flag and valid price
        require(productStorage.isProductActive(productId) && currentPrice == price);        
        
        uint256 unitsToBuy = getUnitsToBuy(productId, units, acceptLessUnits);
        //check if there is enough units to buy
        require(unitsToBuy > 0);
        
        uint256 totalPrice = unitsToBuy.safeMult(price);        
        uint256 discount = discountPolicy.requestBuyerDiscount(msg.sender, totalPrice);        

        //if there is not enough ether to pay even with discount, safe will throw exception
        uint256 etherToReturn = ethAmount.safeAdd(discount).safeSub(totalPrice);        
        
        //transfer excess to customer
        if (etherToReturn > 0) {
            msg.sender.transfer(etherToReturn);
        }

        uint256 purchaseId = productStorage.addPurchase(productId, msg.sender, price, unitsToBuy, clientId);
        processPurchase(productId, purchaseId, totalPrice);        
        
        ProductBought(msg.sender, productId, clientId, price, unitsToBuy, discount);
    }

    /**@dev Sends ether to vendor and provider */
    function processPurchase(uint256 productId, uint256 purchaseId, uint256 etherToPay) internal {
        address owner = productStorage.getProductOwner(productId);
        uint256 fee = feePolicy.calculateFeeAmount(owner, etherToPay);
        uint256 profit = etherToPay.safeSub(fee);
        
        if (productStorage.isEscrowUsed(productId)) {
            productStorage.setEscrowData(productId, purchaseId, msg.sender, fee, profit, now);   
            productStorage.changePurchase(productId, purchaseId, IProductStorage.PurchaseState.Paid);
        } else {
            feePolicy.sendFee.value(fee)();
            productStorage.getVendorWallet(owner).transfer(profit);
        }
    }    
}