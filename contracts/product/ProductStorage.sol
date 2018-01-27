pragma solidity ^0.4.18;

import "../common/Manageable.sol";
import "./IProductStorage.sol";

contract ProductStorage is Manageable, IProductStorage {
    
    //
    //Inner type

    //Purchase information
    struct Purchase {        
        //who made a purchase
        address buyer; 
        //unit price at the moment of purchase
        uint256 price; 
        //how many units bought
        uint256 paidUnits;
        //true if purchase was delivered 
        bool delivered; 
        //true if user changed rating to 'bad'
        bool badRating; 
        //product-specific client id
        string clientId;         
    }

    /**@dev
    Storage data of product
    1. A couple of words on 'denominator'. It shows how many smallest units can 1 unit be splitted into.
    'price' field still represents price per one unit. One unit = 'denominator' * smallest unit. 
    'maxUnits', 'soldUnits' and 'paidUnits' show number of smallest units. 
    For simple products which can't be fractioned 'denominator' should equal 1.

    For example: denominator = 1,000, 'price' = 100,000. 
    a. If user pays for one product (100,000), his 'paidUnits' field will be 1000.
    b. If 'buy' function receives 50,000, that means user is going to buy
        a half of the product, and 'paidUnits' will be calculated as 500.
    c.If 'buy' function receives 100, that means user wants to buy the smallest unit possible
        and 'paidUnits' will be 1;
        
    Therefore 'paidUnits' = 'weiReceived' * 'denominator' / 'price'
    */
    struct ProductData {    
        //product's creator
        address owner;
        //wallet to receive payments
        address wallet;
        //price of one product unit in WEI
        uint256 price;
        //max quantity of limited product units, or 0 if unlimited
        uint256 maxUnits;
        //true if it is possible to buy a product
        bool isActive;
        //how many units already sold
        uint256 soldUnits;
        //this shows how many decimal digits the smallest unit fraction can hold
        uint256 denominator;
        //timestamp of the purchases start
        uint256 startTime;
        //timestamp of the purchases end
        uint256 endTime;
        //custom FeePolicy contract for the product, or 0 if default is used
        address feePolicy;
        //custom payment PostProcessor contract, or 0 if non is used 
        address postProcessor;
        //name of the product 
        string name; 
        //list of overpays to withdraw
        mapping (address => uint256) pendingWithdrawals; 
        //array of purchase information
        Purchase[] purchases; 
        //index of first-purchase structure in Purchase[] array. Starts with 1 so you need to subtract 1 to get actual
        mapping (address => uint256) userRating; 
    }    



    //
    //Events
    event ProductAdded(
        address indexed owner, 
        address indexed wallet, 
        uint256 price, 
        uint256 maxUnits, 
        uint256 denominator,
        uint256 startTime, 
        uint256 endTime, 
        address feePolicy,
        address postProcessor,
        string name
    );

    event PurchaseAdded(
        uint256 indexed productId,        
        address indexed buyer,    
        uint256 price,         
        uint256 paidUnits,        
        string clientId  
    );



    //
    //Storage data    

    //List of all created products
    ProductData[] public products;

    

    //
    //Modifiers
    modifier validProductId(uint256 productId) {
        require(productId < products.length);
        _;
    }

    modifier validPurchaseId(uint256 productId, uint256 purchaseId) {
        require(purchaseId < products[productId].purchases.length);
        _;
    }
    
    
    //
    //Methods

    function ProductStorage() public {        
    }

    /**@dev Returns total amount of products */
    function getTotalProducts() public constant returns(uint256) {
        return products.length;
    }

    /**@dev Returns information about purchase with given index for the given product */
    function getProductData(uint256 productId) 
        public
        constant
        returns(            
            uint256 price, 
            uint256 maxUnits, 
            uint256 soldUnits,
            uint256 denominator            
        ) 
    {
        ProductData storage p = products[productId];
        return (            
            p.price, 
            p.maxUnits, 
            p.soldUnits,
            p.denominator            
        );
    }

    /**@dev Returns information about product's active state and time limits */
    function getProductActivityData(uint256 productId) 
        public
        constant
        returns(            
            bool active, 
            uint256 startTime, 
            uint256 endTime
        ) 
    {
        ProductData storage p = products[productId];
        return (            
            p.isActive, 
            p.startTime, 
            p.endTime
        );
    }

    function getProductPaymentData(uint256 productId) 
        public
        constant        
        returns(
            address wallet,
            address feePolicy,
            address postProcessor
        )
    {
        ProductData storage p = products[productId];
        return (
            p.wallet,
            p.feePolicy,
            p.postProcessor
        );
    }

    /**@dev Returns product's creator */
    function getProductOwner(uint256 productId) 
        public 
        constant         
        returns(address)
    {
        return products[productId].owner;
    }   

    /**@dev Returns product's creator */
    function getProductPrice(uint256 productId) 
        public 
        constant         
        returns(uint256)
    {
        return products[productId].price;
    }   

    /**@dev Returns true if product can be bought now */
    function isProductActive(uint256 productId) 
        public 
        constant         
        returns(bool)
    {
        return products[productId].isActive && 
            (products[productId].startTime == 0 || now >= products[productId].startTime) &&
            (products[productId].endTime == 0 || now <= products[productId].endTime);
    }   


    /**@dev Returns total amount of purchase transactions for the given product */
    function getTotalPurchases(uint256 productId) 
        public 
        constant
        returns (uint256) 
    {
        return products[productId].purchases.length;
    }

    /**@dev Returns information about purchase with given index for the given product */
    function getPurchase(uint256 productId, uint256 purchaseId) 
        public
        constant         
        returns(address buyer, string clientId, uint256 price, uint256 paidUnits, bool delivered, bool badRating) 
    {
        Purchase storage p = products[productId].purchases[purchaseId];
        return (            
            p.buyer,
            p.clientId,
            p.price,   
            p.paidUnits,     
            p.delivered,
            p.badRating);
    }

    // /**@dev Returns purchase/rating structure index for the given product */
    // function getUserRatingIndex(uint256 productId, address user)
    //     public
    //     constant 
    //     returns (uint256)
    // {        
    //     return products[productId].userRating[user];
    // }

    // /**@dev Returns pending withdrawal of given buyer for the given product */
    // function getPendingWithdrawal(uint256 productId, address buyer) 
    //     public 
    //     constant
    //     returns(uint256) 
    // {
    //     return products[productId].pendingWithdrawals[buyer];
    }    


    /**@dev Adds new product to the storage */
    function createProduct(
        address owner, 
        address wallet, 
        uint256 price, 
        uint256 maxUnits, 
        uint256 denominator,
        uint256 startTime, 
        uint256 endTime, 
        address feePolicy,
        address postProcessor,
        string name
    ) 
    public 
    managerOnly
    {
        ProductData storage product = products[products.length++];
        product.owner = owner;
        product.wallet = wallet;
        product.price = price;
        product.maxUnits = maxUnits;
        product.denominator = denominator;
        product.startTime = startTime;
        product.endTime = endTime;
        product.isActive = true;
        product.feePolicy = feePolicy;
        product.postProcessor = postProcessor;
        product.name = name;
        
        ProductAdded(owner, wallet, price, maxUnits, denominator, startTime, endTime, feePolicy, postProcessor, name);
    }


    /**@dev Edits product in the storage */   
    function editProduct(
        uint256 productId,
        address owner, 
        address wallet, 
        uint256 price, 
        uint256 maxUnits, 
        uint256 denominator,
        uint256 startTime, 
        uint256 endTime, 
        address feePolicy,
        address postProcessor,
        string name
    ) 
    public 
    validProductId(productId)
    managerOnly
    {
        ProductData storage product = products[productId];
        product.owner = owner;
        product.wallet = wallet;
        product.price = price;
        product.maxUnits = maxUnits;
        product.denominator = denominator;
        product.startTime = startTime;
        product.endTime = endTime;
        product.isActive = true;
        product.feePolicy = feePolicy;
        product.postProcessor = postProcessor;
        product.name = name;        
    }


    /**@dev  Adds new purchase to the list of given product */
    function addPurchase(
        uint256 productId,        
        address buyer,    
        uint256 price,         
        uint256 paidUnits,        
        string clientId   
    ) 
    public 
    managerOnly
    validProductId(productId)
    {
        Purchase storage purchase = products[productId].purchases[products[productId].purchases.length++];
        purchase.buyer = buyer;
        purchase.price = price;
        purchase.paidUnits = paidUnits;
        purchase.clientId = clientId;    
        
        PurchaseAdded(productId, buyer, price, paidUnits, clientId);
    }


    /**@dev  Sets delivered state */
    // function setDeliveredState(
    //     uint256 productId,
    //     uint256 purchaseId,
    //     bool state
    // ) 
    // public
    // managerOnly
    // validProductId(productId)
    // validPurchaseId(productId, purchaseId)
    // {
    //     products[productId].purchases[purchaseId].delivered = state;
    // }

    // function setRatedPurchaseIndex(uint256 productId, address buyer)

    
    // /**@dev  Sets new rating state */
    // function setBadRating(
    //     uint256 productId,
    //     uint256 purchaseId,
    //     bool badRating
    // ) 
    // public
    // managerOnly
    // validProductId(productId)
    // validPurchaseId(productId, purchaseId)
    // {
    //     products[productId].purchases[purchaseId].badRating = badRating;
    // }
}