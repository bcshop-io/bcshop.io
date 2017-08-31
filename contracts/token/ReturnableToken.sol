pragma solidity ^0.4.10;

import '../common/Manageable.sol';
import './ERC20StandardToken.sol';
import './ReturnTokenAgent.sol';

///Token that when sent to specified contract (returnAgent) invokes additional actions
contract ReturnableToken is Manageable, ERC20StandardToken {

    ReturnTokenAgent public returnAgent;

    function ReturnableToken() {}

    function () payable {}

    function doTransfer(address _from, address _to, uint256 _value) internal {
        super.doTransfer(_from, _to, _value);
        if (_to == address(returnAgent)) {
            returnAgent.returnToken(_from, _value);                
        }
    }

    /**@dev Sets new return agent */
    function setReturnAgent(ReturnTokenAgent agent) managerOnly {
        returnAgent = agent;
    }

}