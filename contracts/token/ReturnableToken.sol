pragma solidity ^0.4.10;

import '../common/Manageable.sol';
import './ERC20StandardToken.sol';
import './ReturnTokenAgent.sol';

///Token that when sent to specified contract (returnAgent) invokes additional actions
contract ReturnableToken is Manageable, ERC20StandardToken {

    //todo. convert to mapping
    //ReturnTokenAgent public returnAgent;
    /**@dev List of return agents */
    mapping (address => bool) public returnAgents;

    function ReturnableToken() {}

    function () payable {}

    // function doTransfer(address _from, address _to, uint256 _value) internal {
    //     super.doTransfer(_from, _to, _value);
    //     if (_to == address(returnAgent)) {
    //         returnAgent.returnToken(_from, _value);                
    //     }
    // }

    // /**@dev Sets new return agent */
    // function setReturnAgent(ReturnTokenAgent agent) managerOnly {
    //     returnAgent = agent;
    // }

    function doTransfer(address _from, address _to, uint256 _value) internal {
        super.doTransfer(_from, _to, _value);
        if (returnAgents[_to]) {
            ReturnTokenAgent(_to).returnToken(_from, _value);                
        }
    }

    /**@dev Sets new return agent */
    function setReturnAgent(ReturnTokenAgent agent) managerOnly {
        returnAgents[address(agent)] = true;
    }

    /**@dev Removes return agent from list */
    function removeReturnAgent(ReturnTokenAgent agent) managerOnly {
        returnAgents[address(agent)] = false;
    }
}