# OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: Personal Consumption Record API
  version: 1.0.0
  description: API documentation for the personal consumption record backend.
paths:
  /api/transactions:
    get:
      summary: List transactions
      description: Retrieve a list of transactions.
      parameters:
        - name: user-id
          in: query
          required: false
          schema:
            type: integer
            default: 1
        - name: year
          in: query
          required: false
          schema:
            type: string
        - name: month
          in: query
          required: false
          schema:
            type: string
        - name: search
          in: query
          required: false
          schema:
            type: string
        - name: startDate
          in: query
          required: false
          description: UTC start date-time. Can be a full ISO 8601 string or YYYY-MM-DD (normalized to UTC midnight, e.g., YYYY-MM-DDT00:00:00.000Z).
          schema:
            type: string
            format: date-time
        - name: endDate
          in: query
          required: false
          description: UTC end date-time. Can be a full ISO 8601 string or YYYY-MM-DD (normalized to UTC midnight, e.g., YYYY-MM-DDT00:00:00.000Z).
          schema:
            type: string
            format: date-time
        - name: minAmount
          in: query
          required: false
          schema:
            type: number
        - name: maxAmount
          in: query
          required: false
          schema:
            type: number
        - name: itemCategoryId
          in: query
          required: false
          schema:
            type: string
          description: Comma-separated list of item category IDs
        - name: paymentCategoryId
          in: query
          required: false
          schema:
            type: string
          description: Comma-separated list of payment category IDs
      responses:
        '200':
          description: A list of transactions
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Transaction'
    post:
      summary: Create a transaction
      description: Adds a new transaction.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionInput'
      responses:
        '201':
          description: Transaction created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Transaction'
        '400':
          description: Missing required fields
        '500':
          description: Error processing request

  /api/transactions/{id}:
    put:
      summary: Update a transaction
      description: Update an existing transaction by ID.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionInput'
      responses:
        '200':
          description: Transaction updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Transaction'
        '400':
          description: Missing required fields
        '404':
          description: Transaction not found or user mismatch
        '500':
          description: Error processing request
    delete:
      summary: Delete a transaction
      description: Delete a transaction by ID.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
        - name: user-id
          in: query
          required: false
          schema:
            type: integer
            default: 1
      responses:
        '204':
          description: No Content
        '404':
          description: Transaction not found or user mismatch
        '500':
          description: Error processing request

  /api/item-categories:
    get:
      summary: List item categories
      description: Retrieve a list of item categories.
      parameters:
        - name: user-id
          in: query
          required: false
          schema:
            type: integer
            default: 1
      responses:
        '200':
          description: A list of item categories
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Category'
    post:
      summary: Create an item category
      description: Adds a new item category.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CategoryInput'
      responses:
        '201':
          description: Item category created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Category'
        '400':
          description: Category name is required
        '500':
          description: Error processing request

  /api/item-categories/{id}:
    put:
      summary: Update an item category
      description: Update an existing item category by ID.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CategoryInput'
      responses:
        '200':
          description: Item category updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Category'
        '400':
          description: Category name is required
        '404':
          description: Category not found or user mismatch
        '500':
          description: Error processing request
    delete:
      summary: Delete an item category
      description: Delete an item category by ID.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
        - name: user-id
          in: query
          required: false
          schema:
            type: integer
            default: 1
      responses:
        '204':
          description: No Content
        '400':
          description: Cannot delete category (in use)
        '404':
          description: Category not found or user mismatch
        '500':
          description: Error processing request

  /api/payment-categories:
    get:
      summary: List payment categories
      description: Retrieve a list of payment categories.
      parameters:
        - name: user-id
          in: query
          required: false
          schema:
            type: integer
            default: 1
      responses:
        '200':
          description: A list of payment categories
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Category'
    post:
      summary: Create a payment category
      description: Adds a new payment category.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CategoryInput'
      responses:
        '201':
          description: Payment category created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Category'
        '400':
          description: Category name is required
        '500':
          description: Error processing request

  /api/payment-categories/{id}:
    put:
      summary: Update a payment category
      description: Update an existing payment category by ID.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CategoryInput'
      responses:
        '200':
          description: Payment category updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Category'
        '400':
          description: Category name is required
        '404':
          description: Category not found or user mismatch
        '500':
          description: Error processing request
    delete:
      summary: Delete a payment category
      description: Delete a payment category by ID.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
        - name: user-id
          in: query
          required: false
          schema:
            type: integer
            default: 1
      responses:
        '204':
          description: No Content
        '400':
          description: Cannot delete category (in use)
        '404':
          description: Category not found or user mismatch
        '500':
          description: Error processing request

  /api/users:
    post:
      summary: Create a user
      description: Adds a new user.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
              required:
                - name
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: User name is required
        '409':
          description: User name already exists
        '500':
          description: Error processing request

components:
  schemas:
    Transaction:
      type: object
      properties:
        transaction_id:
          type: integer
        transaction_date:
          type: string
          format: date-time
          description: Normalized UTC ISO 8601 date-time string.
        item_name:
          type: string
        item_category:
          type: string
          nullable: true
        payment_category:
          type: string
          nullable: true
        amount:
          type: number
        notes:
          type: string
          nullable: true
        item_category_id:
          type: integer
        payment_category_id:
          type: integer
    TransactionInput:
      type: object
      properties:
        user_id:
          type: integer
          default: 1
        transaction_date:
          type: string
          format: date-time
          description: Transaction date-time. Supports full ISO 8601 strings (normalized to UTC) or YYYY-MM-DD format (normalized to UTC midnight, e.g., YYYY-MM-DDT00:00:00.000Z).
        item_name:
          type: string
        item_category_id:
          type: integer
        amount:
          type: number
        payment_category_id:
          type: integer
        notes:
          type: string
          nullable: true
      required:
        - transaction_date
        - item_name
        - item_category_id
        - amount
        - payment_category_id
    Category:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
    CategoryInput:
      type: object
      properties:
        name:
          type: string
        user_id:
          type: integer
          default: 1
      required:
        - name
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
```