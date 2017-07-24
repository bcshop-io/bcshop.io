pragma solidity ^0.4.10;

//Taken from https://github.com/brave-intl/basic-attention-token-crowdsale/blob/master/contracts/SafeMath.sol

/**dev Utility methods for overflow-proof arithmetic operations 
*/
contract SafeMath {

    /**dev Returns the sum of a and b. Throws an exception if it exceeds uint256 limits*/
    function safeAdd(uint256 a, uint256 b) internal returns (uint256) {
        uint256 c = a + b;
        assert(c > a);

        return c;
    }

    /**dev Returns the difference of a and b. Throws an exception if a is less than b*/
    function safeSub(uint256 a, uint56 b) internal returns (uint256) {
        assert(a >= b);
        return a - b;
    }

    /**dev Returns the product of a and b. Throws an exception if it exceeds uint256 limits*/
     function safeMult(uint256 x, uint256 y) internal returns(uint256) {
      uint256 z = x * y;
      assert((x == 0) || (z / x == y));
      return z;
    }
}