pragma solidity ^0.4.10;

import '../common/Manageable.sol';

/**@dev Lockable wallet interface */
contract LockableWallet is Manageable {

    /** Locks funds on account on given amount of days*/
    function lock(uint256 lockPeriodInDays) managerOnly {}
}