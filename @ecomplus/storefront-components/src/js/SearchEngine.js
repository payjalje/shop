import {
  i19clearFilters,
  i19closeFilters,
  i19didYouMean,
  i19filter,
  i19highestPrice,
  i19items,
  i19lowestPrice,
  i19noResultsFor,
  i19refineSearch,
  i19relevance,
  i19results,
  i19sales,
  i19sort
} from '@ecomplus/i18n'

import { i18n } from '@ecomplus/utils'
import EcomSearch from '@ecomplus/search-engine'
import ABackdrop from '../ABackdrop.vue'
import ProductCard from '../ProductCard.vue'

const resetEcomSearch = ({
  ecomSearch,
  term,
  page,
  pageSize,
  brands,
  categories
}) => {
  ecomSearch.reset()
  if (term) {
    ecomSearch.setSearchTerm(term)
  }
  if (page) {
    ecomSearch.setPageNumber(page)
  }
  if (pageSize) {
    ecomSearch.setPageSize(pageSize)
  }
  if (Array.isArray(brands) && brands.length) {
    ecomSearch.setBrandNames(brands)
  }
  if (Array.isArray(categories) && categories.length) {
    ecomSearch.setCategoryNames(categories)
  }
}

export default {
  name: 'SearchEngine',

  components: {
    ABackdrop,
    ProductCard
  },

  props: {
    term: String,
    page: Number,
    pageSize: Number,
    brands: Array,
    categories: Array,
    autoFixScore: {
      type: Number,
      default: 0.6
    },
    isFilterable: {
      type: Boolean,
      default: true
    },
    hasPopularItems: {
      type: Boolean,
      default: true
    },
    canRetry: {
      type: Boolean,
      default: true
    },
    gridsData: {
      type: Array,
      default () {
        if (window.storefront && window.storefront.data) {
          return window.storefront.data.grids
        }
      }
    }
  },

  data () {
    return {
      suggestedTerm: '',
      searchedTerm: '',
      resultItems: [],
      totalSearchResults: 0,
      hasSearched: false,
      filters: [],
      lastSelectedFilter: null,
      selectedOptions: {},
      selectedSortOption: null,
      countOpenRequests: 0,
      lastRequestId: null,
      isScheduled: false,
      isLoadingMore: false,
      hasNetworkError: false,
      popularItems: [],
      hasSetPopularItems: false,
      isAsideVisible: false,
      searchFilterId: 0
    }
  },

  computed: {
    i19clearFilters: () => i18n(i19clearFilters),
    i19closeFilters: () => i18n(i19closeFilters),
    i19didYouMean: () => i18n(i19didYouMean),
    i19filter: () => i18n(i19filter),
    i19items: () => i18n(i19items),
    i19noResultsFor: () => i18n(i19noResultsFor),
    i19relevance: () => i18n(i19relevance),
    i19refineSearch: () => i18n(i19refineSearch),
    i19results: () => i18n(i19results),
    i19sort: () => i18n(i19sort),

    ecomSearch: () => new EcomSearch(),

    isSearching () {
      return this.countOpenRequests > 0
    },

    hasEmptyResult () {
      return this.searchedTerm && !this.resultItems.length
    },

    sortOptions: () => [
      {
        value: null,
        label: i18n(i19relevance)
      }, {
        value: 'sales',
        label: i18n(i19sales)
      }, {
        value: 'lowest_price',
        label: i18n(i19lowestPrice)
      }, {
        value: 'highest_price',
        label: i18n(i19highestPrice)
      }
    ],

    hasSelectedOptions () {
      for (const filter in this.selectedOptions) {
        if (this.selectedOptions[filter] && this.selectedOptions[filter].length) {
          return true
        }
      }
      return false
    },

    isNavVisible () {
      return this.hasSearched &&
        (this.isSearching || this.totalSearchResults > 8 || this.hasSelectedOptions)
    },

    hasFilters () {
      return this.hasSelectedOptions ||
        this.filters.find(({ options }) => options.length)
    }
  },

  methods: {
    fetchItems (isRetry, isPopularItems) {
      const ecomSearch = isPopularItems ? new EcomSearch() : this.ecomSearch
      const requestId = Date.now()
      this.countOpenRequests++
      this.lastRequestId = requestId
      if (!isPopularItems) {
        this.isLoadingMore = this.page > 1
      }
      ecomSearch.fetch()
        .then(() => {
          if (this.lastRequestId === requestId) {
            this.hasNetworkError = false
            if (!isPopularItems) {
              this.handleSearchResult()
            }
          }
          if (isPopularItems) {
            this.hasSetPopularItems = true
            this.popularItems = ecomSearch.getItems()
          }
        })
        .catch(err => {
          console.error(err)
          if (this.lastRequestId === requestId || isPopularItems) {
            if (this.canRetry && !isRetry && (!err.response || err.response.status !== 400)) {
              this.fetchItems(true, isPopularItems)
            } else {
              this.hasNetworkError = true
            }
          }
        })
        .finally(() => {
          this.countOpenRequests--
        })
    },

    updateFilters () {
      const updatedFilters = []
      const addFilter = (filter, options, isSpec) => {
        let filterIndex = this.filters.findIndex(filterObj => filterObj.filter === filter)
        if (filter !== this.lastSelectedFilter) {
          if (filterIndex === -1) {
            filterIndex = this.filters.length
          }
          this.filters[filterIndex] = {
            filter,
            options,
            isSpec
          }
          const optionsList = !this.selectedOptions[filter] ? []
            : this.selectedOptions[filter]
              .filter(option => options.find(({ key }) => key === option))
          this.$set(this.selectedOptions, filter, optionsList)
        }
        updatedFilters.push(filterIndex)
      }
      ;['Brands', 'Categories'].forEach(filter => {
        const presetOptions = this[filter.toLowerCase()]
        if (!presetOptions || !presetOptions.length) {
          addFilter(filter, this.ecomSearch[`get${filter}`]())
        }
      })
      this.ecomSearch.getSpecs().forEach(({ key, options }, index) => {
        addFilter(key, options, true)
      })
      this.filters = this.filters.filter((_, i) => updatedFilters.includes(i))
      this.searchFilterId = Date.now()
    },

    handleSuggestions () {
      const { ecomSearch, term } = this
      let suggestTerm = term
      let canAutoFix = false
      this.suggestedTerm = ''
      ecomSearch.getTermSuggestions().forEach(({ options, text }) => {
        if (options.length) {
          const opt = options[0]
          if (
            !this.totalSearchResults &&
            this.autoFixScore > 0 &&
            opt.score >= this.autoFixScore &&
            opt.text.indexOf(term) === -1
          ) {
            canAutoFix = true
          }
          suggestTerm = suggestTerm.replace(text, opt.text)
        }
      })
      if (suggestTerm !== term) {
        if (canAutoFix) {
          this.$emit('update:term', suggestTerm)
        } else {
          this.suggestedTerm = suggestTerm
        }
        ecomSearch.history.shift()
      }
    },

    handleSearchResult () {
      this.totalSearchResults = this.ecomSearch.getTotalCount()
      this.resultItems = this.isLoadingMore
        ? this.resultItems.concat(this.ecomSearch.getItems())
        : this.ecomSearch.getItems()
      this.updateFilters()
      this.handleSuggestions()
      this.hasSearched = true
      this.searchedTerm = this.term
      if (!this.totalSearchResults && this.hasPopularItems && !this.hasSetPopularItems) {
        this.fetchItems(false, true)
      }
    },

    scheduleFetch () {
      if (!this.isScheduled) {
        this.isScheduled = true
        this.$nextTick(() => {
          setTimeout(() => {
            this.fetchItems()
            this.isScheduled = false
          }, 30)
        })
      }
    },

    resetAndFetch () {
      resetEcomSearch(this)
      this.scheduleFetch()
    },

    toggleFilters (isVisible) {
      this.isAsideVisible = typeof isVisible === 'boolean'
        ? isVisible : !this.isAsideVisible
    },

    getFilterLabel (filter) {
      if (this.gridsData) {
        const grid = this.gridsData.find(grid => grid.grid_id === filter)
        if (grid) {
          return grid.title || grid.grid_id
        }
      }
      return filter
    },

    updateSearchFilter (filter) {
      const { ecomSearch } = this
      let setOptions = this.selectedOptions[filter]
      if (!setOptions.length) {
        setOptions = null
      }
      switch (filter) {
        case 'Brands':
          ecomSearch.setBrandNames(setOptions)
          break
        case 'Categories':
          ecomSearch.setCategoryNames(setOptions)
          break
        default:
          ecomSearch.setSpec(filter, setOptions)
      }
    },

    setFilterOption (filter, option, isSet) {
      const { selectedOptions } = this
      const optionsList = selectedOptions[filter]
      if (isSet) {
        this.lastSelectedFilter = filter
        optionsList.push(option)
      } else {
        const optionIndex = optionsList.indexOf(option)
        if (optionIndex > -1) {
          optionsList.splice(optionIndex, 1)
        }
        if (!optionsList.length && this.lastSelectedFilter === filter) {
          this.lastSelectedFilter = null
        }
      }
      this.updateSearchFilter(filter)
      this.scheduleFetch()
    },

    clearFilters () {
      const { selectedOptions } = this
      for (const filter in selectedOptions) {
        if (selectedOptions[filter]) {
          selectedOptions[filter] = []
          this.updateSearchFilter(filter)
        }
      }
      this.fetchItems()
    }
  },

  watch: {
    term () {
      this.resetAndFetch()
    },
    pageSize () {
      this.resetAndFetch()
    },
    brands () {
      this.resetAndFetch()
    },
    categories () {
      this.resetAndFetch()
    },

    page (page) {
      this.ecomSearch.setPageNumber(page || 1)
      this.scheduleFetch()
    }
  },

  created () {
    resetEcomSearch(this)
    this.fetchItems()
  }
}