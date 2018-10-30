pragma solidity ^0.4.24;

import "./IFund.sol";
import "../common/Manageable.sol";
import "../shop/IWallet.sol";

/**@dev Ether fund that can take Ether from another fund */
contract ProxyFund is IWallet, Manageable {
    
    //
    // Events



    //
    // Storage data
    IFund public baseFund;



    //
    // Methods

    constructor() public {} 

    function setBaseFund(IFund _baseFund) public ownerOnly {
        baseFund = _baseFund;
    }

    /**@dev Returns how much ether can be claimed */
    function getBalance() public view returns (uint256) {
        return address(this).balance + baseFund.etherBalanceOf(this);
    }
    
    /**@dev Withdraws caller's share  */
    function withdraw(uint amount) public managerOnly {
        withdrawTo(msg.sender, amount);
    }

    /**@dev Withdraws caller's share to a given address */
    function withdrawTo(address to, uint256 amount) public managerOnly {
        uint256 fundBalance = baseFund.etherBalanceOf(this);

        if (amount <= fundBalance && amount > address(this).balance) {
            baseFund.withdraw(fundBalance);
        }
        to.transfer(amount);
    }

    function () public payable {}    
}