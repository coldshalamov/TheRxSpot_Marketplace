import { Business } from "./business"
import { Location } from "./location"
import { ProductCategory } from "./product-category"
import { LocationProduct } from "./location-product"
import { ConsultSubmission } from "./consult-submission"
import { ConsultApproval } from "./consult-approval"
import { BusinessDomain } from "./business-domain"
import { BusinessUser } from "./business-user"
import { OrderStatusEvent } from "./order-status-event"
import { OutboxEvent } from "./outbox-event"

export default [Business, Location, ProductCategory, LocationProduct, ConsultSubmission, ConsultApproval, BusinessDomain, BusinessUser, OrderStatusEvent, OutboxEvent]
