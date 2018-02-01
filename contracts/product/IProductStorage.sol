pragma solidity ^0.4.18;

//Abstraction of ProductStorage
contract IProductStorage {

    //
    // Methods

    function getTotalProducts() public constant returns(uint256) 
    {}

    function getTextData(uint256 productId) public constant returns(string name, string data) 
    {}

    /**@dev Returns information about purchase with given index for the given product */
    function getProductData(uint256 productId) 
        public
        constant
        returns(
            uint256 price, 
            uint256 maxUnits, 
            uint256 soldUnits
        ) 
    {}

    function getProductActivityData(uint256 productId) 
        public
        constant
        returns(
            bool active,
            uint256 startTime,
            uint256 endTime
        )
    {}

    function getProductPaymentData(uint256 productId) 
        public
        constant
        returns(
            address wallet,
            address feePolicy
        )
    {}

    /**@dev Returns product's creator */
    function getProductOwner(uint256 productId) 
        public 
        constant 
        returns(address)
    {}   

    /**@dev Returns product's price in wei */
    function getProductPrice(uint256 productId) 
        public 
        constant 
        returns(uint256)
    {}   

    function isProductActive(uint256 productId) 
        public 
        constant         
        returns(bool)
    {}   


    /**@dev Returns total amount of purchase transactions for the given product */
    function getTotalPurchases(uint256 productId) 
        public 
        constant
        returns (uint256) 
    {}

    /**@dev Returns information about purchase with given index for the given product */
    // function getPurchase(uint256 productId, uint256 purchaseId) 
    //     public
    //     constant         
    //     returns(address buyer, string clientId, uint256 price, uint256 paidUnits) 
    // {}

    /**@dev Adds new product to the storage */
    function createProduct(
        address owner, 
        address wallet, 
        uint256 price, 
        uint256 maxUnits,
        uint256 startTime, 
        uint256 endTime, 
        address feePolicy,
        string name,
        string data
    ) public;

    /**@dev Edits product in the storage */   
    function editProduct(
        uint256 productId,
        address wallet, 
        uint256 price, 
        uint256 maxUnits, 
        bool isActive,
        uint256 soldUnits,        
        uint256 startTime, 
        uint256 endTime,         
        string name,
        string data
    ) public;

    /**@dev Sets product's "handlers" parameters */
    function setCustomParams(uint256 productId, address feePolicy) public;

    /**@dev  Adds new purchase to the list of given product */
    function addPurchase(
        uint256 productId,        
        address buyer,    
        uint256 price,         
        uint256 paidUnits,        
        string clientId   
    ) public;    
}