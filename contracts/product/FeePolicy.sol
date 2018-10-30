pragma solidity ^0.4.24;

import "./IProductStorage.sol";
import "./IAffiliateStorage.sol";
import "./IEscrow.sol";
import "./IFeePolicy.sol";
import "../common/Manageable.sol";
import "../common/SafeMathLib.sol";
import "../common/UsePermille.sol";
import "../token/IERC20Token.sol";

/**@dev Calculates fee details. Takes into account BCS tokens that grant fee discount */
contract FeePolicy is UsePermille, Manageable {

    using SafeMathLib for uint256;

    //
    // Events
    event AffiliateFeeSent(address indexed affiliate, address indexed vendor, uint256 fee);
    event ParamsChanged(
        uint16 defaultFee,
        uint16 affiliateFee,
        address feeWallet,
        address token,
        uint256 minTokenForDiscount,        
        uint256 maxDiscountPerToken,
        uint16 discount,
        uint256 denominator
    );
    

    //
    // Storage data    

    IProductStorage public productStorage;
    IAffiliateStorage public affiliateStorage;
    IEscrow public escrowProvider;

    uint16 public defaultFee;               //default fee for genereal products (permille)
    uint16 public affiliateFee;             //affiliate fee if the vendor has one (permille)

    address public feeWallet;               //wallet of the platform 
    
    IERC20Token public token;               // token to check fee discount
    uint256 public minTokenForDiscount;     // min token amount to get fee discount
    uint256 public termDuration;            // term duration in seconds
    uint256 public maxDiscountPerToken;     // max total fee discount/token per term in weis (Y from the docs)
    uint16 public discount;                 // discount permille [0-1000] (X from the docs)
    mapping(address=>mapping(uint256=>uint256)) public totalFeeDiscount; // total fee for combination of vendor+term

    uint256 denominator;                    //maxDiscountPerToken*tokens/denominator = maxTotalDiscount per term


    //
    // Methods

    constructor(
        IProductStorage _productStorage,
        IAffiliateStorage _affiliateStorage,
        IEscrow _escrowProvider,
        uint16 _defaultFeePermille, 
        uint16 _affiliateFeePermille,
        address _feeWallet,        
        IERC20Token _token,
        uint256 _minTokenForDiscount,
        uint256 _termDuration,
        uint256 _maxDiscountPerToken,
        uint16 _discountPermille
    ) 
        public 
    {
        require(_termDuration > 0);
        
        productStorage = _productStorage;
        termDuration = _termDuration;
        affiliateStorage = _affiliateStorage;
        escrowProvider = _escrowProvider;

        setParams(
            _defaultFeePermille,
            _affiliateFeePermille,
            _feeWallet,
            _token,
            _minTokenForDiscount,        
            _maxDiscountPerToken,
            _discountPermille
        );
    }

    /**@dev Returns total fee amount depending on payment */
    function getFeeDetails(address vendor, uint256 productId, uint256 payment) 
        public 
        view 
        returns(uint256 baseFeeAmount, uint256 escrowFeeAmount, uint256 feeDiscount)
    {
        uint16 baseFee = productStorage.getVendorFee(vendor);
        if(baseFee == 0) {
            baseFee = defaultFee;
        }

        uint16 escrowFee = 0;
        if(productStorage.isEscrowUsed(productId)) {
            escrowFee = escrowProvider.getProductEscrowFee(productId);
        }

        uint16 fee = baseFee + escrowFee;
        require(fee <= MAXPERMILLE);

        baseFeeAmount = payment.safePm(baseFee);
        escrowFeeAmount = payment.safePm(escrowFee);
                
        feeDiscount = 0;
        //check if we should apply discount for fee
        if(token.balanceOf(vendor) >= minTokenForDiscount) {
            uint256 remainingDiscount = getRemainingDiscount(vendor);

            //apply discount first to the base fee
            feeDiscount = baseFeeAmount.safePm(discount).min(remainingDiscount);
            baseFeeAmount = baseFeeAmount.safeSub(feeDiscount);
            remainingDiscount = remainingDiscount.safeSub(feeDiscount);

            //then if there is still discount remaining, apply it to the escrow fee 
            if(remainingDiscount > 0) {
                uint256 escrowFeeDiscount = escrowFeeAmount.safePm(discount).min(remainingDiscount);
                escrowFeeAmount = escrowFeeAmount.safeSub(escrowFeeDiscount);
                feeDiscount = feeDiscount.safeAdd(escrowFeeDiscount);
            }
        }        
    }

    /**@dev Returns max fee discount that can be accumulated during every term */
    function getMaxTotalDiscount(address vendor) public view returns (uint256) {
        return maxDiscountPerToken.safeMult(token.balanceOf(vendor)) / denominator;
    }


    /**@dev Returns remaining discount for the current term */
    function getRemainingDiscount(address vendor) public view returns(uint256) {
        uint256 term = now / termDuration;  //current term #
        uint256 maxTotalDiscount = getMaxTotalDiscount(vendor);

        if(totalFeeDiscount[vendor][term] < maxTotalDiscount) {
            return maxTotalDiscount - totalFeeDiscount[vendor][term];            
        } else {
            return 0;
        }
    }

    /**@dev Returns extended information about remaining discount: discount + timestamp when current term expires */
    function getRemainingDiscountInfo(address vendor) public view returns(uint256, uint256) {
        return (
            getRemainingDiscount(vendor), 
            (now / termDuration + 1) * termDuration
        );
    }

    /**@dev Calculates and returns base fee amount and escrow fee amount. 
    Writes the calculated discount for the current term to storage  */
    function calculateFeeAmount(address vendor, uint256 productId, uint256 payment) 
        public 
        managerOnly 
        returns(uint256, uint256) 
    {
        (uint256 baseFee, uint256 escrowFee, uint256 feeDiscount) = getFeeDetails(vendor, productId, payment);
        
        if(feeDiscount > 0) {
            uint256 term = now / termDuration;
            totalFeeDiscount[vendor][term] = totalFeeDiscount[vendor][term].safeAdd(feeDiscount);
        }
        
        return (baseFee, escrowFee);
    }

    /**@dev Splits fees between affiliate and platform. msg.value is fee amount */    
    function sendFee(address vendor) public payable managerOnly {        
        uint256 affiliateFeeAmount = 0;
        uint256 platformFeeAmount = msg.value;

        address affiliate = affiliateStorage.affiliates(vendor);

        //calculate affiliate fee only if there is an address in the storage, other than vendor address itself
        if(affiliate != 0x0) {
        //if(affiliateStorage.affiliateSet(vendor)) {            
            affiliateFeeAmount = platformFeeAmount.safePm(affiliateFee);
            platformFeeAmount = platformFeeAmount.safeSub(affiliateFeeAmount);
            
            affiliate.transfer(affiliateFeeAmount);
            emit AffiliateFeeSent(affiliate, vendor, affiliateFeeAmount);
        }

        feeWallet.transfer(platformFeeAmount);        
    }

    /**@dev Sets new parameters values */
    function setParams(
        uint16 _defaultFeePermille,
        uint16 _affiliateFeePermille,
        address _feeWallet,
        IERC20Token _token,
        uint256 _minTokenForDiscount,        
        uint256 _maxDiscountPerToken,
        uint16 _discountPermille
    ) 
        public 
        ownerOnly
        validPermille(_defaultFeePermille)
        validPermille(_affiliateFeePermille)
        validPermille(_discountPermille)

    {
        //require(_defaultFeePermille  <= 1000);

        defaultFee = _defaultFeePermille;
        affiliateFee = _affiliateFeePermille;
        feeWallet = _feeWallet;
        token = _token;
        minTokenForDiscount = _minTokenForDiscount;
        maxDiscountPerToken = _maxDiscountPerToken;
        discount = _discountPermille;

        denominator = uint256(10) ** token.decimals();

        emit ParamsChanged(_defaultFeePermille, _affiliateFeePermille, _feeWallet, address(_token),
                            _minTokenForDiscount, _maxDiscountPerToken, _discountPermille, denominator
        );
    }
}