pragma solidity ^0.4.24;

import "../token/IERC20Token.sol";
import "../token/TokenHolder.sol";

/**@dev Vendors use this contract to request approval. 
Managers should call grantApprove function to resolve the case.
Also serves for storage of vendor token payment while approve is being processed */
contract VendorApprove is TokenHolder {
	
    //
    // Events
    
    //fired when approve is requested (state:true) or request is canceled by vendor (state:false) 
    event ApprovalRequested(address indexed sender, bool state);
    event ApprovalGranted(address indexed sender, bool state);


    //
    // Storage data
    IERC20Token public token;
    uint256 public tokensForApproval;               //the price in tokens for application
    mapping(address => bool) public allowedUsers;   //users who are allowed to grant approvals
    mapping(address => uint256) public requests;    //amount of tokens paid for request for each application
    mapping(address => bool) public approved;       //list of approved applications


    //
    // Modifiers
    modifier allowedUserOnly() {
        require(allowedUsers[msg.sender]);
        _;
    }


    //
    // Methods

    constructor(IERC20Token _token, uint256 _tokensForApproval, address[] users) public {
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

        emit ApprovalRequested(msg.sender, true);
    }

    /**@dev call this to cancel request and return deposited tokens */
    function cancelRequest() public {
        require(requests[msg.sender] > 0);

        uint256 transferAmount = requests[msg.sender];
        requests[msg.sender] = 0;
        require(token.transfer(msg.sender, transferAmount));

        emit ApprovalRequested(msg.sender, false);
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

        emit ApprovalGranted(sender, state);

        uint256 transferAmount = requests[sender];
        requests[sender] = 0;

        if(!state) {        
            require(token.transfer(sender, transferAmount));            
        } else {
            approved[sender] = true;
        }
    }
}