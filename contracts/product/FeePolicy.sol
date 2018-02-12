pragma solidity ^0.4.18;


import "../common/Owned.sol";
import "./IFeePolicy.sol";


contract FeePolicy is Owned {

    //
    // Storage data

    uint256 constant MAXPERMILLE = 1000;

    uint256 public feePermille;
    address public feeWallet;



    //
    // Methods

    function FeePolicy(uint256 _feePermille, address _feeWallet) public {
        require(_feePermille >= 0 && _feePermille <= MAXPERMILLE);

        feePermille = _feePermille;
        feeWallet = _feeWallet;
    }

    /**@dev Returns total fee amount depending on payment */
    function getFeeAmount(address owner, uint256 payment) public constant returns(uint256) {
        return payment * feePermille / MAXPERMILLE;
    }

    /**@dev Sends fee amount equal to msg.value to a single fee wallet  */
    function sendFee() external payable {
        feeWallet.transfer(msg.value);
    }

    /**@dev Sets new parameters values */
    function setParams(uint256 _feePermille, address _feeWallet) public ownerOnly {
        require(_feePermille >= 0 && _feePermille <= MAXPERMILLE);

        feePermille = _feePermille;
        feeWallet = _feeWallet;
    }
}