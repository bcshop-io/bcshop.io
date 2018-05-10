pragma solidity ^0.4.18;

import "../token/IERC20Token.sol";
import "../token/TokenHolder.sol";

/**@dev Vendors use this contract to request approval. 
Managers should call grantApprove function to resolve the case.
Also serves for storage of vendor token payment while approve is being processed */
contract VendorApprove is TokenHolder {
	
    //
    // Events
    event ApprovalRequested(address indexed sender);
    event ApprovalGranted(address indexed sender, bool state);


    //
    // Storage data
    IERC20Token public token;
    uint256 public tokensForApproval;
    mapping(address => bool) public allowedUsers;
    mapping(address => uint256) public requests;


    //
    // Modifiers
    modifier allowedUserOnly() {
        require(allowedUsers[msg.sender]);
        _;
    }


    //
    // Methods

    function VendorApprove(IERC20Token _token, uint256 _tokensForApproval, address[] users) public {
        setParams(_token, _tokensForApproval);
        setAllowedUsers(true, users);
    }

    function setParams(IERC20Token _token, uint256 _tokensForApproval) public ownerOnly {
        token = _token;
        tokensForApproval = _tokensForApproval;
    }

    /**@dev Allows or denies particular users to manage approvals  */
    function setAllowedUsers(bool state, address[] users) public ownerOnly {
        for(uint256 i = 0; i < users.length; ++i) {
            allowedUsers[users[i]] = state;
        }
    }

    /**@dev Call this to request approval, throws exception if there is another request pending.
    Tokens should be approved for transfer prior to calling this */
    function requestApprove() public {
        require(requests[msg.sender] == 0);

        token.transferFrom(msg.sender, this, tokensForApproval);
        requests[msg.sender] = tokensForApproval;

        ApprovalRequested(msg.sender);
    }

    /**@dev Approval manager calls this method to grant or deny approval */
    function grantApprovals(address[] senders, bool[] states) 
        public
        allowedUserOnly
    {
        require(senders.length == states.length);

        for(uint256 i = 0; i < senders.length; ++i) {
            grantApprove(senders[i], states[i]);
        }
    }

    function grantApprove(address sender, bool state) 
        internal 
    {
        require(requests[sender] > 0);

        ApprovalGranted(sender, state);

        if(!state) {        
            require(token.transfer(sender, requests[sender]));            
        }
        requests[sender] = 0;
    }
}