pragma solidity ^0.4.10;

import './FloorInvestRestrictions.sol';

/**@dev In addition to floor behavior restricts investments if there are already too many investors */
contract ParticipantInvestRestrictions is FloorInvestRestrictions {

    /**@dev Maximum number of allowed investors (unreserved only) */
    uint32 public maxInvestors;

    /**@dev Maximum number of reserved places for investors */
    uint32 public maxReservedInvestors;

    /**@dev Current number of unreserved investors */
    uint32 public investorsCount;

    /**@dev Current number of reserved investors */
    uint32 public reservedInvestorsCount;

    /**@dev True if address is reserved */
    mapping (address => bool) public reservedInvestors;

    function ParticipantInvestRestrictions(uint256 _floor, uint32 _maxTotalInvestors, uint32 _reservedInvestors)
        FloorInvestRestrictions(_floor)
    {
        require(_maxTotalInvestors >= _reservedInvestors);
        
        maxReservedInvestors = _reservedInvestors;
        maxInvestors = _maxTotalInvestors - _reservedInvestors;
    }

    /**@dev IInvestRestrictions override */
    function canInvest(address investor, uint amount) constant returns (bool result) {
        //First check ancestor's restriction. 
        //Allow only if it is reserved investor or it invested earlier or there is still room for new investors
        result = super.canInvest(investor, amount) && 
                    (reservedInvestors[investor] || 
                    investors[investor] || 
                    investorsCount < maxInvestors);
    }

    /**@dev IInvestRestrictions override */
    function investHappened(address investor, uint amount) managerOnly {
        if (!investors[investor]) {
            investors[investor] = true;

            if (!reservedInvestors[investor]) {
                investorsCount++;
            }
        }
    }

    /**@dev Reserves a place for investor */
    function reserveFor(address investor) managerOnly {
        require(!investors[investor] && reservedInvestorsCount < maxReservedInvestors);

        reservedInvestorsCount++;
        reservedInvestors[investor] = true;
    }

    /**@dev Unreserves special address. For example if investor haven't sent ether */
    function unreserveFor(address investor) managerOnly {
        require(reservedInvestors[investor] && !investors[investor]);

        reservedInvestorsCount--;
        reservedInvestors[investor] = false;
    }
}