pragma solidity ^0.4.10;

import './DividendWallet.sol';

/* Based on 
https://github.com/o0ragman0o/PayableERC20/blob/master/contracts/PayableERC20.sol
https://github.com/o0ragman0o/Bakt/blob/master/contracts/Bakt.sol
https://medium.com/@weka/dividend-bearing-tokens-on-ethereum-42d01c710657
*/

//TODO Forbidden addresses - addresses whose tokens aren't taken into account when dividends are paid
//Also they can't withdraw funds from this wallet

/**@dev Can distribute all stored ether among floating supply token holders. */
contract DividendWalletFloating is DividendWallet {

    uint constant MULTIPLIER = 10 ** 18;

    /**@dev The running tally of dividends points accured by dividend/totalSupply at each dividend payment */
    uint dividendPoints;    

    /**@dev dividendPoints at the moment of holder's last update*/
    mapping (address => uint256) lastClaimed;

    function DividendWalletFloating(ValueToken token) DividendWallet(token) {}
    
    function totalDividendPoints() constant returns (uint256) {
        return safeAdd(dividendPoints, MULTIPLIER * safeSub(this.balance, lastBalance) / valueToken.getValuableTokenAmount());
        //return safeAdd(dividendPoints, MULTIPLIER * (this.balance - lastBalance) / valueToken.getValuableTokenAmount()); 
    }    

    /**@dev DividendWallet override */
    function updateHolder(address holder) internal {  
        // Update unprocessed deposits
        if (lastBalance != this.balance) {
            dividendPoints = totalDividendPoints();
            lastBalance = this.balance;
        }

        //don't update balance for reserved tokens
        if (!valueToken.reserved(holder)) {
            // Claim share of deposits since last claim
            etherBalance[holder] = safeAdd(etherBalance[holder], claimableEther(holder));
        }
        // Save dividend points for holder
        lastClaimed[holder] = dividendPoints;
    }    

    /**@dev DividendWallet override */
    function claimableEther(address holder) internal constant returns (uint256) {
        return (totalDividendPoints() - lastClaimed[holder]) * valueToken.balanceOf(holder) / MULTIPLIER; 
    }

    /**@dev DividendWallet override */
    // function doWithdraw(address holder, uint amount) 
    //     internal 
    //     preventReentry
    // {
    //     updateHolder(holder);
        
    //     // check balance and withdraw on valid amount
    //     require(amount <= etherBalance[holder]);
    //     etherBalance[holder] = safeSub(etherBalance[holder], amount);

    //     lastBalance = safeSub(lastBalance, amount);
        
    //     Withdraw(holder, amount);
    //     holder.transfer(amount);    
    // }
}