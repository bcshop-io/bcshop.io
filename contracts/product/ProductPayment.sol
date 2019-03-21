pragma solidity ^0.4.24;

import "../common/Active.sol";
import "../common/SafeMathLib.sol";
import "../common/Manageable.sol";
import "../token/IERC20Token.sol";
import "../common/EtherHolder.sol";
import "./IProductStorage.sol";
import "./IEscrow.sol";
import "./IFeePolicy.sol";
import "./IPurchaseHandler.sol";
import "./IDiscountPolicy.sol";
import "./IBancorConverter.sol";
import "./IEtherPriceProvider.sol";
import "./IRevokedStorage.sol";

/**@dev This contact accepts payments for products and transfers ether to all the parties */
contract ProductPayment is EtherHolder, Active {

    using SafeMathLib for uint256;



    //
    //Events

    //emitted during purchase process. Id is 0-based index of purchase in the engine.purchases array
    event ProductBought(
        address indexed buyer, 
        address indexed vendor, 
        uint256 indexed productId, 
        uint256 purchaseId,
        string clientId, 
        uint256 price, 
        uint256 paidUnits, 
        uint256 discount
    );
    //emitted in revoke function
    event PurchaseRevoked(address indexed vendor, uint256 indexed productId, uint256 purchaseId);
    //emitted in resolve function
    event DisputeResolved(
        address indexed escrow,
        uint256 indexed productId,
        uint256 indexed purchaseId,
        uint8 refundPct
    );
    
    //emitted in complain function
    event ComplainMade(
        address indexed vendor,
        address indexed customer, 
        uint256 indexed productId,
        uint256 purchaseId
    );
    event DeliverConfirmed(address indexed customer, uint256 indexed productId, uint256 purchaseId);


    //
    // Storage data

    IProductStorage public productStorage;
    IEscrow public escrowProvider;
    IFeePolicy public feePolicy;
    IDiscountPolicy public discountPolicy;
    IRevokedStorage public revokedStorage;
    //contract that stores ether/usd exchange rate
    IEtherPriceProvider public etherPriceProvider;
    //token that can be used as payment tool
    IERC20Token public token;
    // Bancor converter to convert BCS to ETH. 
    IBancorConverter public converter;
    // escrow payment hold time in seconds 
    address[] public convertPath;



    //
    // Methods

    constructor(
        IProductStorage _productStorage,
        IEscrow _escrowProvider, 
        IFeePolicy _feePolicy, 
        IDiscountPolicy _discountPolicy,
        IRevokedStorage _revokedStorage,
        IERC20Token _token,
        IEtherPriceProvider _etherPriceProvider        
    ) 
    public 
    {
        setParams(_productStorage, _escrowProvider, _feePolicy, _discountPolicy, _revokedStorage, _token, _etherPriceProvider);
    }
    
    //allows to receive direct ether transfers
    function() public payable {}
    

    /**@dev Sets convert path for changing BCS to ETH through Bancor */
    function setConvertParams(IBancorConverter _converter, address[] _convertPath) public ownerOnly {
        converter = _converter;
        convertPath = _convertPath;        
    }


    /**@dev Changes parameters */
    function setParams(
        IProductStorage _productStorage,
        IEscrow _escrowProvider,
        IFeePolicy _feePolicy, 
        IDiscountPolicy _discountPolicy,
        IRevokedStorage _revokedStorage,
        IERC20Token _token,
        IEtherPriceProvider _etherPriceProvider
    ) 
        public 
        ownerOnly 
    {
        productStorage = _productStorage;
        escrowProvider = _escrowProvider;
        feePolicy = _feePolicy;
        discountPolicy = _discountPolicy;
        revokedStorage = _revokedStorage;
        token = _token;
        etherPriceProvider = _etherPriceProvider;
    }

    
    function getUnitsToBuy(uint256 productId, uint256 units, bool acceptLessUnits) public view returns(uint256) {
        (uint256 price, uint256 maxUnits, uint256 soldUnits) = productStorage.getProductData(productId);

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
    function canWithdrawPending(uint256 productId, uint256 purchaseId) public view returns(bool) {
        IProductStorage.PurchaseState state = productStorage.getPurchase(productId, purchaseId);
        (address customer, uint256 fee, uint256 profit, uint256 timestamp) = productStorage.getEscrowData(productId, purchaseId);

        return state == IProductStorage.PurchaseState.Pending || 
            (state == IProductStorage.PurchaseState.Paid && esrowHoldTimeElapsed(productId, purchaseId));

        // return state == IProductStorage.PurchaseState.Pending 
        //     || (state == IProductStorage.PurchaseState.Paid && esrowHoldTimeElapsed(productId, purchaseId));

    }

    /**@dev Returns true if escrow time elapsed */
    function esrowHoldTimeElapsed(uint256 productId, uint256 purchaseId) public view returns (bool) {
        (address customer, uint256 fee, uint256 profit, uint256 timestamp) = productStorage.getEscrowData(productId, purchaseId);        
        return timestamp + escrowProvider.getProductEscrowHoldTime(productId) <= now;
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
        //store bcsConverter, access via extensions
        IBancorQuickConverter quickConverter = converter.extensions().quickConverter();
        token.transferFrom(msg.sender, quickConverter, tokens);        
        uint256 ethAmount = quickConverter.convertFor(convertPath, tokens, 1, this);

        //use received ether for payment
        buy(ethAmount, productId, units, clientId, acceptLessUnits, currentPrice);
    }   


    /**@dev Make a complain on purchase, only customer can call this method */
    function complain(uint256 productId, uint256 purchaseId) 
        public 
        activeOnly 
    {
        (address customer, uint256 fee, uint256 profit, uint256 timestamp) = 
            productStorage.getEscrowData(productId, purchaseId);
        
        uint256 escrowHoldTime = escrowProvider.getProductEscrowHoldTime(productId);
        //check purchase current state, valid customer and time limits
        require(
            productStorage.getPurchase(productId, purchaseId) == IProductStorage.PurchaseState.Paid && 
            customer == msg.sender &&
            timestamp + escrowHoldTime > now
        );
        
        //change purchase status
        productStorage.changePurchase(productId, purchaseId, IProductStorage.PurchaseState.Complain); 

        emit ComplainMade(productStorage.getProductOwner(productId), customer, productId, purchaseId);       
    }


    /**@dev Confirms that purchase was delivered. Customer calls this to release escrow-locked funds to vendor */
    function confirmDeliver(uint256 productId, uint256 purchaseId) 
        public
        activeOnly 
    {
        //check status is Paid
        require(productStorage.getPurchase(productId, purchaseId) == IProductStorage.PurchaseState.Paid);

        //check if msg.sender is valid customer
        (address customer, uint256 fee, uint256 profit, uint256 timestamp) = 
            productStorage.getEscrowData(productId, purchaseId);
        require(msg.sender == customer);
        
        //change purchase state to Pending
        productStorage.changePurchase(productId, purchaseId, IProductStorage.PurchaseState.Pending);

        emit DeliverConfirmed(msg.sender, productId, purchaseId);
    }


    /**@dev Allows vendor to revoke purchase is it wasn't complained yet
    * Ether in amount of escrow fee should be attached
    */
    function revoke(uint256 productId, uint256 purchaseId) 
        public
        payable
        activeOnly 
    {
        //check if its valid vendor
        require(msg.sender == productStorage.getProductOwner(productId));
        
        //check state is Paid and hold time not elapsed
        require(
            productStorage.getPurchase(productId, purchaseId) == IProductStorage.PurchaseState.Paid 
            && !esrowHoldTimeElapsed(productId, purchaseId)
        );

        require(msg.value == revokedStorage.escrowFee(productId, purchaseId));

        //change state
        productStorage.changePurchase(productId, purchaseId, IProductStorage.PurchaseState.Finished);
        revokedStorage.setRevokedFlag(productId, purchaseId, true);

        //return payment to customer
        (address customer, uint256 fee, uint256 profit, uint256 timestamp) = 
            productStorage.getEscrowData(productId, purchaseId);
        customer.transfer(fee.safeAdd(profit).safeAdd(msg.value));

        emit PurchaseRevoked(msg.sender, productId, purchaseId);
    }


    /**@dev Resolves a complain on specific purchase. 
    If cancelPayment is true, payment returns to customer; otherwise - to the vendor 
    refundPct - a percentage of merchant's profit to be sent to customer */
    function resolve(uint256 productId, uint256 purchaseId, uint8 refundPct) 
        public
        activeOnly
    {
        require(refundPct >= 0 && refundPct <= 100);

        //check escrow validity - product escrow or default escrow
        require(
            msg.sender == escrowProvider.getProductEscrow(productId) ||
            msg.sender == escrowProvider.defaultEscrow()
        );
        
        require(productStorage.getPurchase(productId, purchaseId) == IProductStorage.PurchaseState.Complain);
        
        (address customer, uint256 fee, uint256 profit, uint256 timestamp) = productStorage.getEscrowData(productId, purchaseId);
        
        if(refundPct > 0) {
            uint256 refundProfit = profit * refundPct / 100.0;
            uint256 refundFee = fee * refundPct / 100.0;

            profit = profit.safeSub(refundProfit);
            fee = fee.safeSub(refundFee);

            productStorage.setEscrowData(productId, purchaseId, customer, fee, profit, timestamp);
            customer.transfer(refundFee.safeAdd(refundProfit));            
            
        } 
                
        productStorage.changePurchase(
            productId, 
            purchaseId, 
            refundPct < 100 ? IProductStorage.PurchaseState.Pending : IProductStorage.PurchaseState.Finished
        );

        emit DisputeResolved(msg.sender, productId, purchaseId, refundPct);
    }


    /**@dev withdraws multiple pending payments */
    function withdrawPendingPayments(uint256[] productIds, uint256[] purchaseIds) 
        public 
        activeOnly 
    {
        require(productIds.length == purchaseIds.length);
        address customer;
        uint256 fee;
        uint256 profit;
        uint256 timestamp;

        uint256 totalProfit = 0;
        uint256 totalFee = 0;

        for(uint256 i = 0; i < productIds.length; ++i) {
            (customer, fee, profit, timestamp) = productStorage.getEscrowData(productIds[i], purchaseIds[i]);
            
            require(msg.sender == productStorage.getProductOwner(productIds[i]));
            require(canWithdrawPending(productIds[i], purchaseIds[i]));

            productStorage.changePurchase(productIds[i], purchaseIds[i], IProductStorage.PurchaseState.Finished);

            totalFee = totalFee.safeAdd(fee);
            totalProfit = totalProfit.safeAdd(profit);
        }

        productStorage.getVendorWallet(msg.sender).transfer(totalProfit);
        feePolicy.sendFee.value(totalFee)(msg.sender);
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
        activeOnly
    {
        require(productId < productStorage.getTotalProducts());
        require(!productStorage.banned(productId));

        uint256 price = productStorage.getProductPrice(productId);

        //check for active flag and valid price
        require(productStorage.isProductActive(productId) && currentPrice == price);
        
        uint256 unitsToBuy = getUnitsToBuy(productId, units, acceptLessUnits);        
        //check if there is enough units to buy
        require(unitsToBuy > 0);
        
        uint256 totalPrice = unitsToBuy.safeMult(price);

        //check fiat price usage
        if(productStorage.isFiatPriceUsed(productId)) {
            totalPrice = totalPrice.safeMult(etherPriceProvider.rate());
            price = totalPrice / unitsToBuy;
        }
        
        uint256 cashback = discountPolicy.requestCustomerDiscount(msg.sender, totalPrice);

        //if there is not enough ether to pay even with discount, safeSub will throw exception
        uint256 etherToReturn = ethAmount.safeSub(totalPrice);

        uint256 purchaseId = productStorage.addPurchase(productId, msg.sender, price, unitsToBuy, clientId);
        processPurchase(productId, purchaseId, totalPrice);

        //transfer excess to customer
        if (etherToReturn > 0) {
            msg.sender.transfer(etherToReturn);
        }
        
        emit ProductBought(
           msg.sender, 
           productStorage.getProductOwner(productId), 
           productId, 
           purchaseId, 
           clientId, 
           price, 
           unitsToBuy, 
           cashback
        );
    }


    /**@dev Sends ether payment to all the parties */
    function processPurchase(uint256 productId, uint256 purchaseId, uint256 etherToPay) internal {
        address owner = productStorage.getProductOwner(productId);
        (uint256 baseFee, uint256 escrowFee) = feePolicy.calculateFeeAmount(owner, productId, etherToPay);
        uint256 profit = etherToPay.safeSub(baseFee + escrowFee);
                
        if (productStorage.isEscrowUsed(productId)) {
            productStorage.setEscrowData(productId, purchaseId, msg.sender, baseFee, profit, now);
            productStorage.changePurchase(productId, purchaseId, IProductStorage.PurchaseState.Paid);

            //send escrow fee anyway 
            escrowProvider.getProductEscrow(productId).transfer(escrowFee);
            revokedStorage.saveEscrowFee(productId, purchaseId, escrowFee);
        } else {
            feePolicy.sendFee.value(baseFee)(owner);
            productStorage.getVendorWallet(owner).transfer(profit);
        }
    }
}