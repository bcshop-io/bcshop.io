pragma solidity ^0.4.10;

import './ValueTokenAgent.sol';
import './ValueToken.sol';
import './IDividendWallet.sol';
import '../common/SafeMath.sol';
import '../common/ReentryProtected.sol';

/* Based on 
https://github.com/o0ragman0o/PayableERC20/blob/master/contracts/PayableERC20.sol
https://github.com/o0ragman0o/Bakt/blob/master/contracts/Bakt.sol
https://medium.com/@weka/dividend-bearing-tokens-on-ethereum-42d01c710657
*/

/**@dev Can distribute all stored ether among token holders */
contract DividendWallet is ValueTokenAgent, IDividendWallet, SafeMath, ReentryProtected {

    event Withdraw(address receiver, uint256 amount);

    /**@dev Token whose transfers that contract watches */
    ValueToken public valueToken;
    
    /**@dev Ether balance to withdraw */
    mapping (address => uint256) public etherBalance;

    /**@dev The contract balance at last claim (transfer or withdraw) */
    uint lastBalance;

    /**@dev Allows only token to execute method */
    modifier valueTokenOnly {require(msg.sender == address(valueToken)); _;}

    /**@dev Sets token to watch transfer operations */
    function DividendWallet(ValueToken token) {
        valueToken = token;
    }

    function () payable {}

    /**@dev ValueTokenAgnet override. Validates the state of each holder's dividend to be paid */
    function tokenIsBeingTransferred(address from, address to, uint256 amount) valueTokenOnly {
        require(from != to);        
        
        updateHolder(from);
        updateHolder(to);
    }

    /**@dev ValueTokenAgent override */
    function tokenChanged(address holder, uint256 amount) {
        updateHolder(holder);
    }

    /**@dev Withdraws all sender's ether balance */
    function withdrawAll() returns (bool) {
        require(!valueToken.reserved(msg.sender));
        return doWithdraw(msg.sender, etherBalanceOf(msg.sender));
    }

    /**@dev Withdraw an amount of the sender's ether balance */
    function withdraw(uint amount) returns (bool) {
        require(!valueToken.reserved(msg.sender));
        return doWithdraw(msg.sender, amount);
    }
    
    /**@dev Withdraw on behalf of a balance holder */
    function withdrawFor(address holder, uint amount) returns (bool) {
        require(!valueToken.reserved(holder));
        return doWithdraw(holder, amount);
    }
    
    /**@dev Account specific ethereum balance getter */
    function etherBalanceOf(address holder) constant returns (uint) {
        return safeAdd(etherBalance[holder], claimableEther(holder));
    }    

    /** @dev Updates holder state before transfer tokens or ether withdrawal */
    function updateHolder(address holder) internal;

    /**@dev Returns amount of ether that specified holder can withdraw  */
    function claimableEther(address holder) internal constant returns (uint256);

    /**@dev Account withdrawl function */
    //function doWithdraw(address holder, uint amount) internal returns (bool);
    function doWithdraw(address holder, uint amount) 
        internal 
        preventReentry
        returns (bool success)
    {
        updateHolder(holder);
        
        // check balance and withdraw on valid amount
        require(amount <= etherBalance[holder]);
        etherBalance[holder] = safeSub(etherBalance[holder], amount);

        lastBalance = safeSub(lastBalance, amount);
        
        Withdraw(holder, amount);        
        holder.transfer(amount);    

        success = true;
    }
}

