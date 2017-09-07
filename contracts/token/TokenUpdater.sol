pragma solidity ^0.4.10;

import './IERC20Token.sol';
import './TokenHolder.sol';

/**@dev Can exchange one token to another. The common usage process is
1. Lock token transfer on oldToken in order to prevent transfer and get exploits
2. Transfer amount of newToken equal to oldToken.totalSupply to this contract
3. oldToken holders call getUpdatedToken function to receive newTokens equal to their balance
 */
contract TokenUpdater is TokenHolder {

    mapping (address => uint256) public claimedTokens;

    IERC20Token oldToken;
    IERC20Token newToken;

    function TokenUpdater(IERC20Token _oldToken, IERC20Token _newToken) {
        oldToken = _oldToken;
        newToken = _newToken;
    }

    /**@dev Transfers to sender the newToken in amount equal to its balance of oldToken (considering the decimals) */
    function getUpdatedToken() {
        getUpdatedTokenFor(msg.sender);
    }

    /**@dev Transfers to holder the newToken in amount equal to its balance of oldToken (considering the decimals) */
    function getUpdatedTokenFor(address holder) {
        uint256 amount = oldToken.balanceOf(holder);
        require(claimedTokens[holder] < amount);
        
        amount = amount - claimedTokens[holder];

        claimedTokens[holder] += amount;
        amount = amount * (10 ** newToken.decimals()) / (10 ** oldToken.decimals());
        newToken.transfer(holder, amount);
    }

}