pragma solidity ^0.4.18;

import "./IProductStorage.sol";
import "./IFeePolicy.sol";
import "../common/Manageable.sol";
import "../common/SafeMathLib.sol";
import "../token/IERC20Token.sol";


contract FeePolicy is Manageable {

    using SafeMathLib for uint256;

    //
    // Storage data

    uint256 constant MAXPERMILLE = 1000;

    IProductStorage productStorage;
    uint16 public defaultFee;
    address public feeWallet;
    
    IERC20Token public token;                  // token to check minimum token balance
    uint256 public minTokenForDiscount;        // min token amount to get fee discount
    uint256 public termDuration;               // term duration in seconds
    uint256 public maxTotalDiscount;           // max total fee discount per term
    uint256 public discount;                   // discount permille [0-1000]
    mapping(address=>mapping(uint256=>uint256)) public totalFee; // total fee for combination of vendor+term



    //
    // Methods

    function FeePolicy(
        IProductStorage _productStorage,
        uint16 _defaultFeePermille, 
        address _feeWallet,
        IERC20Token _token,
        uint256 _minTokenForDiscount,
        uint256 _termDuration,
        uint256 _maxTotalDiscount,
        uint256 _discountPermille
    ) 
        public 
    {
        require(_defaultFeePermille >= 0 && _defaultFeePermille <= MAXPERMILLE);
        require(_discountPermille >= 0 && _discountPermille <= MAXPERMILLE);
        require(_termDuration > 0);

        productStorage = _productStorage;
        defaultFee = _defaultFeePermille;
        feeWallet = _feeWallet;
        token = _token;
        minTokenForDiscount = _minTokenForDiscount;
        termDuration = _termDuration;
        maxTotalDiscount = _maxTotalDiscount;
        discount = _discountPermille;
    }

    /**@dev Returns total fee amount depending on payment */
    function getFeeDetails(address owner, uint256 payment) public constant returns(uint256 feeAmount, uint256 feeDiscount) {
        int16 fee = productStorage.getVendorFee(owner);
        if(fee == -1) {
            fee = int16(defaultFee);
        }
        feeAmount = payment * uint256(fee) / MAXPERMILLE;
        feeDiscount = 0;
        //check if we should apply discount for fee
        if(token.balanceOf(owner) > minTokenForDiscount) {
            feeDiscount = feeAmount * (1000 - discount) / 1000;

            uint256 remainingDiscount = getRemainingDiscount(owner);
            if(feeDiscount > remainingDiscount) {
                feeDiscount = remainingDiscount;
            }
            feeAmount = feeAmount - feeDiscount;            
        }        
    }

    /**@dev Returns remaining discount for the current term */
    function getRemainingDiscount(address owner) public constant returns(uint256) {
        uint256 term = now / termDuration;  //current term #
        if(totalFee[owner][term] < maxTotalDiscount) {
            return maxTotalDiscount - totalFee[owner][term];            
        } else {
            return 0;
        }
    }

    /**@dev Calculates and returns fee amount  */
    function calculateFeeAmount(address owner, uint256 payment) public managerOnly returns(uint256) {
        var (feeAmount, feeDiscount) = getFeeDetails(owner, payment);
        
        if(feeDiscount > 0) {
            uint256 term = now / termDuration;
            totalFee[owner][term] = totalFee[owner][term].safeAdd(feeDiscount);
        }
        
        return feeAmount;
    }

    /**@dev Sends fee amount equal to msg.value to a single fee wallet  */
    function sendFee() public payable {
        feeWallet.transfer(msg.value);
    }

    /**@dev Sets new parameters values */
    function setParams(
        uint16 _defaultFeePermille, 
        address _feeWallet,
        IERC20Token _token,
        uint256 _minTokenForDiscount,
        uint256 _termDuration,
        uint256 _maxTotalDiscount,
        uint256 _discountPermille
    ) 
        public 
        ownerOnly
    {
        require(_defaultFeePermille >= 0 && _defaultFeePermille <= MAXPERMILLE);
        require(_discountPermille >= 0 && _discountPermille <= MAXPERMILLE);
        require(_termDuration > 0);

        defaultFee = _defaultFeePermille;
        feeWallet = _feeWallet;
        token = _token;
        minTokenForDiscount = _minTokenForDiscount;
        termDuration = _termDuration;
        maxTotalDiscount = _maxTotalDiscount;
        discount = _discountPermille;
    }
}