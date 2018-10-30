pragma solidity ^0.4.24;

/**dev Utility methods for overflow-proof arithmetic operations 
*/
library SafeMathLib {

    /**dev Returns the sum of a and b. Throws an exception if it exceeds uint256 limits*/
    function safeAdd(uint256 self, uint256 b) internal pure returns (uint256) {        
        uint256 c = self + b;
        require(c >= self);

        return c;
    }

    /**dev Returns the difference of a and b. Throws an exception if a is less than b*/
    function safeSub(uint256 self, uint256 b) internal pure returns (uint256) {
        require(self >= b);
        return self - b;
    }

    /**dev Returns the product of a and b. Throws an exception if it exceeds uint256 limits*/
    function safeMult(uint256 self, uint256 y) internal pure returns(uint256) {
        uint256 z = self * y;
        require((self == 0) || (z / self == y));
        return z;
    }

    function safeDiv(uint256 self, uint256 y) internal pure returns (uint256) {
        require(y != 0);
        return self / y;
    }

    //calculates fee permille 
    function safePm(uint256 self, uint16 fee) 
        internal
        pure
        returns (uint256)
    {
        require (fee <= 1000);
        return safeMult(self, uint256(fee)) / 1000;
    }

    function min(uint256 self, uint256 other) internal pure returns (uint256) {
        return (self < other ? self : other);
    }

    function max(uint256 self, uint256 other) internal pure returns (uint256) {
        return (self > other ? self : other);
    }
}